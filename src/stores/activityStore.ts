/**
 * Activity Store
 * Pedometer-based step tracking with daily records persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';

const STRIDE_LENGTH_METERS = 0.762;
const CALORIES_PER_1000_STEPS = 35;

export interface DailyStepRecord {
    date: string;       // 'YYYY-MM-DD'
    steps: number;
    distance: number;   // meters
    calories: number;   // kcal
}

interface ActivityState {
    todaySteps: number;
    todayDistance: number;
    todayCalories: number;
    isPedometerAvailable: boolean | null;
    isLoading: boolean;

    dailyRecords: DailyStepRecord[];
    lastSavedDate: string | null;

    initializePedometer: () => Promise<void>;
    updateTodaySteps: (steps: number) => void;
    loadTodayFromPedometer: () => Promise<void>;
    loadHistoricalData: (days: number) => Promise<void>;
    getYesterdaySteps: () => number;
    getWeeklyData: (weeksAgo?: number) => DailyStepRecord[];
    getMonthlyData: (monthsAgo?: number) => DailyStepRecord[];
    resetDailyIfNeeded: () => void;
}

function getTodayString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getDateString(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMidnight(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function computeDistance(steps: number): number {
    return steps * STRIDE_LENGTH_METERS;
}

function computeCalories(steps: number): number {
    return (steps / 1000) * CALORIES_PER_1000_STEPS;
}

export const useActivityStore = create<ActivityState>()(
    persist(
        (set, get) => ({
            todaySteps: 0,
            todayDistance: 0,
            todayCalories: 0,
            isPedometerAvailable: null,
            isLoading: true,

            dailyRecords: [],
            lastSavedDate: null,

            initializePedometer: async () => {
                try {
                    const available = await Pedometer.isAvailableAsync();
                    set({ isPedometerAvailable: available });
                } catch {
                    set({ isPedometerAvailable: false });
                }
            },

            updateTodaySteps: (steps: number) => {
                set({
                    todaySteps: steps,
                    todayDistance: computeDistance(steps),
                    todayCalories: computeCalories(steps),
                });
            },

            loadTodayFromPedometer: async () => {
                const { isPedometerAvailable } = get();
                if (!isPedometerAvailable) {
                    set({ isLoading: false });
                    return;
                }

                try {
                    const now = new Date();
                    const midnight = getMidnight(now);
                    const result = await Pedometer.getStepCountAsync(midnight, now);
                    const steps = result.steps;
                    set({
                        todaySteps: steps,
                        todayDistance: computeDistance(steps),
                        todayCalories: computeCalories(steps),
                        isLoading: false,
                    });
                } catch {
                    set({ isLoading: false });
                }
            },

            loadHistoricalData: async (days: number) => {
                const { isPedometerAvailable, dailyRecords } = get();
                if (!isPedometerAvailable) return;

                const existingDates = new Set(dailyRecords.map((r) => r.date));
                const newRecords: DailyStepRecord[] = [];
                const today = new Date();

                for (let i = 1; i <= days; i++) {
                    const targetDate = new Date(today);
                    targetDate.setDate(today.getDate() - i);
                    const dateStr = getDateString(targetDate);

                    if (existingDates.has(dateStr)) continue;

                    try {
                        const start = getMidnight(targetDate);
                        const end = new Date(start);
                        end.setDate(end.getDate() + 1);

                        const result = await Pedometer.getStepCountAsync(start, end);
                        if (result.steps > 0) {
                            newRecords.push({
                                date: dateStr,
                                steps: result.steps,
                                distance: computeDistance(result.steps),
                                calories: computeCalories(result.steps),
                            });
                        }
                    } catch {
                        // Skip days that fail
                    }
                }

                if (newRecords.length > 0) {
                    const merged = [...dailyRecords, ...newRecords]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .slice(0, 60);
                    set({ dailyRecords: merged });
                }
            },

            getYesterdaySteps: () => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const dateStr = getDateString(yesterday);
                const record = get().dailyRecords.find((r) => r.date === dateStr);
                return record?.steps ?? 0;
            },

            getWeeklyData: (weeksAgo = 0) => {
                const { dailyRecords } = get();
                const today = new Date();
                const dayOfWeek = today.getDay();
                const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - mondayOffset - weeksAgo * 7);
                weekStart.setHours(0, 0, 0, 0);

                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 7);

                const result: DailyStepRecord[] = [];
                for (let i = 0; i < 7; i++) {
                    const d = new Date(weekStart);
                    d.setDate(weekStart.getDate() + i);
                    const dateStr = getDateString(d);

                    const existing = dailyRecords.find((r) => r.date === dateStr);
                    result.push(existing ?? { date: dateStr, steps: 0, distance: 0, calories: 0 });
                }

                return result;
            },

            getMonthlyData: (monthsAgo = 0) => {
                const { dailyRecords } = get();
                const today = new Date();
                const targetMonth = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
                const nextMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 1);
                const daysInMonth = Math.round((nextMonth.getTime() - targetMonth.getTime()) / (1000 * 60 * 60 * 24));

                const result: DailyStepRecord[] = [];
                for (let i = 0; i < daysInMonth; i++) {
                    const d = new Date(targetMonth);
                    d.setDate(targetMonth.getDate() + i);
                    const dateStr = getDateString(d);

                    const existing = dailyRecords.find((r) => r.date === dateStr);
                    result.push(existing ?? { date: dateStr, steps: 0, distance: 0, calories: 0 });
                }

                return result;
            },

            resetDailyIfNeeded: () => {
                const { lastSavedDate, todaySteps } = get();
                const todayStr = getTodayString();

                if (lastSavedDate && lastSavedDate !== todayStr) {
                    if (todaySteps > 0) {
                        const prevRecord: DailyStepRecord = {
                            date: lastSavedDate,
                            steps: todaySteps,
                            distance: computeDistance(todaySteps),
                            calories: computeCalories(todaySteps),
                        };

                        const { dailyRecords } = get();
                        const existingIndex = dailyRecords.findIndex((r) => r.date === lastSavedDate);

                        let updatedRecords: DailyStepRecord[];
                        if (existingIndex >= 0) {
                            updatedRecords = [...dailyRecords];
                            updatedRecords[existingIndex] = prevRecord;
                        } else {
                            updatedRecords = [prevRecord, ...dailyRecords].slice(0, 60);
                        }

                        set({
                            dailyRecords: updatedRecords,
                            todaySteps: 0,
                            todayDistance: 0,
                            todayCalories: 0,
                            lastSavedDate: todayStr,
                        });
                    } else {
                        set({ lastSavedDate: todayStr });
                    }
                } else if (!lastSavedDate) {
                    set({ lastSavedDate: todayStr });
                }
            },
        }),
        {
            name: 'activity-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                dailyRecords: state.dailyRecords,
                lastSavedDate: state.lastSavedDate,
            }),
        }
    )
);

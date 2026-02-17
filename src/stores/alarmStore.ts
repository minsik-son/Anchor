/**
 * Alarm Store - Zustand state management for alarms
 */

import { create } from 'zustand';
import { Alarm, ActionMemo, CreateAlarmInput, CreateActionMemoInput } from '../db/schema';
import * as db from '../db/database';

interface AlarmState {
    alarms: Alarm[];
    activeAlarm: Alarm | null;
    currentMemos: ActionMemo[];
    isLoading: boolean;
    error: string | null;
    dismissedAlarmId: number | null;

    // Actions
    loadAlarms: () => Promise<void>;
    loadActiveAlarm: () => Promise<void>;
    createAlarm: (input: CreateAlarmInput) => Promise<number>;
    updateAlarm: (id: number, updates: Partial<CreateAlarmInput & { is_active: boolean }>) => Promise<void>;
    deleteAlarm: (id: number) => Promise<void>;
    deleteAllAlarms: () => Promise<void>;
    deactivateAlarm: (id: number) => Promise<void>;
    completeAlarm: (id: number) => Promise<void>;

    // Memo actions
    loadMemos: (alarmId: number) => Promise<void>;
    addMemo: (input: CreateActionMemoInput) => Promise<void>;
    toggleMemoChecked: (id: number, isChecked: boolean) => Promise<void>;
    deleteMemo: (id: number) => Promise<void>;

    // Utility
    clearError: () => void;
}

export const useAlarmStore = create<AlarmState>((set, get) => ({
    alarms: [],
    activeAlarm: null,
    currentMemos: [],
    isLoading: false,
    error: null,
    dismissedAlarmId: null,

    loadAlarms: async () => {
        set({ isLoading: true, error: null });
        try {
            const alarms = await db.getAllAlarms();
            set({ alarms, isLoading: false });
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    loadActiveAlarm: async () => {
        try {
            const activeAlarms = await db.getActiveAlarms();
            set({ activeAlarm: activeAlarms[0] ?? null });
        } catch (error) {
            console.error('[AlarmStore] Failed to load active alarm:', error);
        }
    },

    createAlarm: async (input) => {
        set({ isLoading: true, error: null, dismissedAlarmId: null });
        try {
            const id = await db.createAlarm(input);
            await get().loadAlarms();
            await get().loadActiveAlarm();
            return id;
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
            throw error;
        }
    },

    updateAlarm: async (id, updates) => {
        try {
            await db.updateAlarm(id, updates);
            await get().loadAlarms();
            await get().loadActiveAlarm();
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    deleteAlarm: async (id) => {
        try {
            await db.deleteAlarm(id);
            await get().loadAlarms();
            await get().loadActiveAlarm();
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    deleteAllAlarms: async () => {
        try {
            await db.deleteAllAlarms();
            set({ alarms: [], activeAlarm: null, currentMemos: [] });
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    deactivateAlarm: async (id) => {
        try {
            await db.updateAlarm(id, { is_active: false });
            await get().loadAlarms();
            await get().loadActiveAlarm();
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    completeAlarm: async (id) => {
        try {
            // Set dismissedAlarmId immediately to prevent re-triggering
            set({ dismissedAlarmId: id });
            await db.updateAlarm(id, { is_active: false, arrived_at: new Date().toISOString() });
            await get().loadAlarms();
            await get().loadActiveAlarm();
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    loadMemos: async (alarmId) => {
        try {
            const memos = await db.getActionMemosByAlarmId(alarmId);
            set({ currentMemos: memos });
        } catch (error) {
            console.error('[AlarmStore] Failed to load memos:', error);
        }
    },

    addMemo: async (input) => {
        try {
            await db.createActionMemo(input);
            await get().loadMemos(input.alarm_id);
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    toggleMemoChecked: async (id, isChecked) => {
        try {
            await db.updateActionMemoChecked(id, isChecked);
            const { currentMemos } = get();
            if (currentMemos.length > 0) {
                await get().loadMemos(currentMemos[0].alarm_id);
            }
        } catch (error) {
            console.error('[AlarmStore] Failed to toggle memo:', error);
        }
    },

    deleteMemo: async (id) => {
        try {
            const { currentMemos } = get();
            await db.deleteActionMemo(id);
            if (currentMemos.length > 0) {
                await get().loadMemos(currentMemos[0].alarm_id);
            }
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    clearError: () => set({ error: null }),
}));

/**
 * Routine Store - Zustand state management for recurring location-based alarms
 */

import { create } from 'zustand';
import { RoutineRow, CreateRoutineInput, UpdateRoutineInput } from '../db/schema';
import * as db from '../db/database';

export interface Routine {
    id: string;
    name: string;
    icon: string;
    locationName: string;
    latitude: number;
    longitude: number;
    radius: number;
    startTime: string;
    endTime: string;
    repeatDays: number[];
    isEnabled: boolean;
    sound: string;
    memo: string;
}

function toRoutine(row: RoutineRow): Routine {
    return {
        id: String(row.id),
        name: row.name,
        icon: row.icon,
        locationName: row.location_name,
        latitude: row.latitude,
        longitude: row.longitude,
        radius: row.radius,
        startTime: row.start_time,
        endTime: row.end_time,
        repeatDays: row.repeat_days,
        isEnabled: row.is_enabled,
        sound: row.sound,
        memo: row.memo,
    };
}

interface RoutineState {
    routines: Routine[];
    isLoading: boolean;
    error: string | null;
    activeRoutineId: number | null;
    fulfilledRoutineIds: Set<number>;

    loadRoutines: () => Promise<void>;
    createRoutine: (input: CreateRoutineInput) => Promise<number>;
    updateRoutine: (id: number, updates: UpdateRoutineInput) => Promise<void>;
    toggleRoutine: (id: number, enabled: boolean) => Promise<void>;
    deleteRoutine: (id: number) => Promise<void>;
    deleteAllRoutines: () => Promise<void>;
    setActiveRoutineId: (id: number | null) => void;
    markRoutineFulfilled: (id: number) => void;
    clearFulfilledRoutine: (id: number) => void;
    getEnabledRoutines: () => Routine[];
    clearError: () => void;
}

export const useRoutineStore = create<RoutineState>((set, get) => ({
    routines: [],
    isLoading: false,
    error: null,
    activeRoutineId: null,
    fulfilledRoutineIds: new Set<number>(),

    loadRoutines: async () => {
        set({ isLoading: true, error: null });
        try {
            const rows = await db.getAllRoutines();
            set({ routines: rows.map(toRoutine), isLoading: false });
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    createRoutine: async (input) => {
        set({ isLoading: true, error: null });
        try {
            const id = await db.createRoutine(input);
            await get().loadRoutines();
            return id;
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
            throw error;
        }
    },

    updateRoutine: async (id, updates) => {
        try {
            await db.updateRoutine(id, updates);
            await get().loadRoutines();
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    toggleRoutine: async (id, enabled) => {
        try {
            await db.updateRoutine(id, { is_enabled: enabled });
            await get().loadRoutines();
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    deleteRoutine: async (id) => {
        try {
            const { activeRoutineId } = get();
            await db.deleteRoutine(id);

            if (activeRoutineId === id) {
                set({ activeRoutineId: null });
            }

            await get().loadRoutines();
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    deleteAllRoutines: async () => {
        try {
            await db.deleteAllRoutines();
            set({ routines: [], activeRoutineId: null, fulfilledRoutineIds: new Set() });
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    setActiveRoutineId: (id) => set({ activeRoutineId: id }),

    markRoutineFulfilled: (id) => {
        const { fulfilledRoutineIds } = get();
        const next = new Set(fulfilledRoutineIds);
        next.add(id);
        set({ fulfilledRoutineIds: next });
    },

    clearFulfilledRoutine: (id) => {
        const { fulfilledRoutineIds } = get();
        const next = new Set(fulfilledRoutineIds);
        next.delete(id);
        set({ fulfilledRoutineIds: next });
    },

    getEnabledRoutines: () => {
        return get().routines.filter(r => r.isEnabled);
    },

    clearError: () => set({ error: null }),
}));

/**
 * Dev Store - Development-only time offset for testing challenge logic
 */

import { create } from 'zustand';

interface DevState {
    timeOffsetDays: number;
    setTimeOffset: (days: number) => void;
    resetTimeOffset: () => void;
}

export const useDevStore = create<DevState>((set) => ({
    timeOffsetDays: 0,
    setTimeOffset: (days) => set({ timeOffsetDays: days }),
    resetTimeOffset: () => set({ timeOffsetDays: 0 }),
}));

/**
 * Returns the effective "now" date, applying dev time offset in __DEV__ mode.
 * Used by challengeStore for all time-dependent logic.
 */
export function getEffectiveNow(): Date {
    const now = new Date();
    if (__DEV__) {
        const offset = useDevStore.getState().timeOffsetDays;
        if (offset !== 0) {
            now.setDate(now.getDate() + offset);
        }
    }
    return now;
}

/**
 * Routine Manager - Orchestrator bridging time windows + location tracking
 *
 * Evaluates enabled routines against the current time/day and starts or stops
 * location tracking accordingly. Designed to run on:
 *   - App foreground (AppState 'active')
 *   - Background location ticks (via callback registration)
 */

import { useAlarmStore } from '../stores/alarmStore';
import { useLocationStore } from '../stores/locationStore';
import { useRoutineStore, Routine } from '../stores/routineStore';
import { startTracking as startServiceTracking, stopAllTracking, getCurrentLocation } from './location/locationService';
import { calculateDistance } from './location/geofence';

// ---------------------------------------------------------------------------
// Time Utilities
// ---------------------------------------------------------------------------

function parseTime(timeStr: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
}

function toMinutes(t: { hours: number; minutes: number }): number {
    return t.hours * 60 + t.minutes;
}

function isWithinTimeWindow(nowMin: number, startMin: number, endMin: number): boolean {
    if (startMin <= endMin) {
        // Normal window (e.g., 08:00 → 18:00)
        return nowMin >= startMin && nowMin < endMin;
    }
    // Cross-midnight window (e.g., 23:00 → 01:00)
    return nowMin >= startMin || nowMin < endMin;
}

/**
 * Returns the relevant day(s) of the week to check for a routine.
 * For cross-midnight windows, the after-midnight portion belongs to the previous day's schedule.
 */
function getRelevantDays(now: Date, startMin: number, endMin: number): number[] {
    const todayDow = now.getDay();

    if (startMin <= endMin) {
        return [todayDow];
    }

    // Cross-midnight: nowMin < endMin means we're in the after-midnight part → check yesterday
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < endMin) {
        const yesterdayDow = (todayDow + 6) % 7;
        return [yesterdayDow];
    }

    return [todayDow];
}

// ---------------------------------------------------------------------------
// Core Logic
// ---------------------------------------------------------------------------

let lastEvaluateAt = 0;
const DEBOUNCE_MS = 5_000;

function findActiveRoutine(routines: Routine[], now: Date): Routine | null {
    const { fulfilledRoutineIds } = useRoutineStore.getState();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    for (const routine of routines) {
        const routineNumId = Number(routine.id);
        if (fulfilledRoutineIds.has(routineNumId)) continue;

        const startMin = toMinutes(parseTime(routine.startTime));
        const endMin = toMinutes(parseTime(routine.endTime));

        if (!isWithinTimeWindow(nowMin, startMin, endMin)) continue;

        const relevantDays = getRelevantDays(now, startMin, endMin);
        const hasMatchingDay = relevantDays.some(day => routine.repeatDays.includes(day));
        if (!hasMatchingDay) continue;

        return routine;
    }

    return null;
}

/**
 * Clean up fulfilled IDs whose time window has closed,
 * so they can re-trigger on the next matching window.
 */
function cleanupFulfilledIds(routines: Routine[], now: Date): void {
    const store = useRoutineStore.getState();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    for (const id of store.fulfilledRoutineIds) {
        const routine = routines.find(r => Number(r.id) === id);
        if (!routine) {
            store.clearFulfilledRoutine(id);
            continue;
        }

        const startMin = toMinutes(parseTime(routine.startTime));
        const endMin = toMinutes(parseTime(routine.endTime));

        if (!isWithinTimeWindow(nowMin, startMin, endMin)) {
            store.clearFulfilledRoutine(id);
        }
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function evaluate(): Promise<void> {
    const now = Date.now();
    if (now - lastEvaluateAt < DEBOUNCE_MS) return;
    lastEvaluateAt = now;

    // One-shot alarms take priority
    const { activeAlarm } = useAlarmStore.getState();
    if (activeAlarm) return;

    const routineStore = useRoutineStore.getState();
    const enabledRoutines = routineStore.getEnabledRoutines();
    const currentDate = new Date();

    cleanupFulfilledIds(enabledRoutines, currentDate);

    const matchedRoutine = findActiveRoutine(enabledRoutines, currentDate);
    const matchedId = matchedRoutine ? Number(matchedRoutine.id) : null;
    const { activeRoutineId } = routineStore;

    if (matchedId !== null && matchedId !== activeRoutineId) {
        await startRoutineTracking(matchedRoutine!);
    } else if (matchedId === null && activeRoutineId !== null) {
        await stopRoutineTracking();
    }
}

async function startRoutineTracking(routine: Routine): Promise<void> {
    const target = { latitude: routine.latitude, longitude: routine.longitude };
    const locationStore = useLocationStore.getState();
    const routineStore = useRoutineStore.getState();

    try {
        const location = await getCurrentLocation();
        const initialDistance = calculateDistance(
            { latitude: location.coords.latitude, longitude: location.coords.longitude },
            target,
        );

        routineStore.setActiveRoutineId(Number(routine.id));

        await locationStore.startTracking(target, routine.radius, location);
        await startServiceTracking(target, routine.radius, initialDistance);

        console.log('[RoutineManager] Started tracking for routine:', routine.name, 'distance:', initialDistance);
    } catch (error) {
        console.error('[RoutineManager] Failed to start tracking:', error);
        routineStore.setActiveRoutineId(null);
    }
}

async function stopRoutineTracking(): Promise<void> {
    const routineStore = useRoutineStore.getState();
    const locationStore = useLocationStore.getState();

    routineStore.setActiveRoutineId(null);
    locationStore.stopTracking();

    console.log('[RoutineManager] Stopped routine tracking');
}

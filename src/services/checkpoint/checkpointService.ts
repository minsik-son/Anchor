/**
 * Checkpoint Service — periodic persistence of route tracking data
 * Saves route history to SQLite at intervals so data survives app crashes/kills.
 *
 * Strategy: Fire-and-forget pattern — checkpoint failures never stop tracking.
 */

import * as db from '../../db/database';
import { RoutePoint } from '../../stores/locationStore';

const CHECKPOINT_POINT_INTERVAL = 50;  // Save every 50 route points
const CHECKPOINT_TIME_MS = 5 * 60 * 1000;  // Or every 5 minutes

let lastCheckpointCount = 0;
let lastCheckpointTime = Date.now();

/**
 * Conditionally checkpoint route data based on point count or time elapsed.
 * Call after every addRoutePoint.
 */
export async function maybeCheckpoint(
    alarmId: number,
    routeHistory: RoutePoint[],
    traveledDistance: number,
): Promise<void> {
    const now = Date.now();
    const pointsSinceLastCheckpoint = routeHistory.length - lastCheckpointCount;
    const timeSinceLastCheckpoint = now - lastCheckpointTime;

    if (pointsSinceLastCheckpoint < CHECKPOINT_POINT_INTERVAL &&
        timeSinceLastCheckpoint < CHECKPOINT_TIME_MS) {
        return;  // Not time yet
    }

    try {
        await db.upsertTrackingSession({
            alarm_id: alarmId,
            route_points: JSON.stringify(routeHistory),
            traveled_distance: traveledDistance,
            last_checkpoint_at: new Date().toISOString(),
            is_active: true,
        });

        lastCheckpointCount = routeHistory.length;
        lastCheckpointTime = now;
        console.log(`[Checkpoint] Saved ${routeHistory.length} points for alarm ${alarmId}`);
    } catch (error) {
        // Checkpoint failure should never stop tracking
        console.warn('[Checkpoint] Failed to save:', error);
    }
}

/**
 * Reset checkpoint state. Call when starting new tracking session.
 */
export function resetCheckpoint(): void {
    lastCheckpointCount = 0;
    lastCheckpointTime = Date.now();
}

/**
 * Finalize tracking session — mark as inactive.
 */
export async function finalizeCheckpoint(alarmId: number): Promise<void> {
    try {
        await db.deactivateTrackingSession(alarmId);
        console.log(`[Checkpoint] Session finalized for alarm ${alarmId}`);
    } catch (error) {
        console.warn('[Checkpoint] Failed to finalize:', error);
    }
}

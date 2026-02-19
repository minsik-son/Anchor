/**
 * Telemetry Service — local event logging for debugging and analytics
 * Stores events in SQLite for later analysis/export.
 *
 * Events are fire-and-forget: failures never affect app behavior.
 */

import * as db from '../../db/database';

let currentSessionId: string | null = null;

/**
 * Start a new telemetry session. Returns session ID.
 */
export function startTelemetrySession(): string {
    currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    console.log(`[Telemetry] Session started: ${currentSessionId}`);
    return currentSessionId;
}

/**
 * Log an event to the telemetry store.
 */
export async function logEvent(
    eventType: string,
    data?: Record<string, any>,
): Promise<void> {
    if (!currentSessionId) return;
    try {
        await db.insertTelemetryLog({
            session_id: currentSessionId,
            event_type: eventType,
            event_data: data ? JSON.stringify(data) : null,
        });
    } catch {
        // Telemetry failure must never affect app behavior
    }
}

/**
 * End the current telemetry session.
 */
export function endTelemetrySession(): void {
    if (currentSessionId) {
        console.log(`[Telemetry] Session ended: ${currentSessionId}`);
    }
    currentSessionId = null;
}

/**
 * Get the current session ID (or null if not started).
 */
export function getCurrentSessionId(): string | null {
    return currentSessionId;
}

/**
 * Clean up old telemetry logs.
 */
export async function cleanOldLogs(retentionDays: number = 30): Promise<void> {
    try {
        await db.cleanOldTelemetryLogs(retentionDays);
        console.log(`[Telemetry] Cleaned logs older than ${retentionDays} days`);
    } catch {
        // Non-critical
    }
}

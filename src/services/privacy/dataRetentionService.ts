/**
 * Data Retention Service
 * Manages automatic cleanup of old data and user data deletion.
 */

import * as db from '../../db/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RETENTION_DAYS = 90;
const LAST_CLEANUP_KEY = '@locaalert:last_data_cleanup';

/**
 * Clean expired route data from old alarms.
 * Runs automatically on app start if last cleanup was >24 hours ago.
 */
export async function cleanExpiredData(): Promise<void> {
    try {
        // Check if cleanup is needed (once per day max)
        const lastCleanup = await AsyncStorage.getItem(LAST_CLEANUP_KEY);
        if (lastCleanup) {
            const lastCleanupDate = new Date(lastCleanup);
            const hoursSinceCleanup = (Date.now() - lastCleanupDate.getTime()) / (1000 * 60 * 60);
            if (hoursSinceCleanup < 24) return;
        }

        const database = db.getDatabase();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
        const cutoffStr = cutoff.toISOString();

        // Remove route_points from old inactive alarms (keep alarm record)
        await database.runAsync(
            `UPDATE alarms SET route_points = NULL WHERE is_active = 0 AND created_at < ?`,
            [cutoffStr]
        );

        // Clean old telemetry logs
        await db.cleanOldTelemetryLogs(RETENTION_DAYS);

        // Clean old inactive tracking sessions
        await database.runAsync(
            `DELETE FROM tracking_sessions WHERE is_active = 0 AND last_checkpoint_at < ?`,
            [cutoffStr]
        );

        await AsyncStorage.setItem(LAST_CLEANUP_KEY, new Date().toISOString());
        console.log('[Privacy] Expired data cleaned');
    } catch (error) {
        console.warn('[Privacy] Cleanup failed:', error);
    }
}

/**
 * Delete ALL user data. Used in Settings > Delete All Data.
 */
export async function deleteAllUserData(): Promise<void> {
    const database = db.getDatabase();

    // Delete all alarm data
    await database.runAsync('DELETE FROM action_memos');
    await database.runAsync('DELETE FROM alarms');

    // Delete all challenge data
    await database.runAsync('DELETE FROM visit_records');
    await database.runAsync('DELETE FROM challenges');

    // Delete tracking sessions
    await database.runAsync('DELETE FROM tracking_sessions');

    // Delete telemetry
    await database.runAsync('DELETE FROM telemetry_logs');

    // Delete custom actions
    await database.runAsync('DELETE FROM custom_actions');

    // Clear AsyncStorage
    await AsyncStorage.clear();

    console.log('[Privacy] All user data deleted');
}

/**
 * Alarm Dismiss Service
 *
 * Handles alarm dismissal from background contexts (notification actions, etc.)
 * without requiring the app to be in the foreground or alarm-trigger screen to be open.
 */

import { stopBackgroundAlarm } from './backgroundAlarmService';
import { clearAllAlarmNotifications } from '../notification/notificationService';
import { useAlarmStore } from '../../stores/alarmStore';
import { useLocationStore } from '../../stores/locationStore';
import { stopAllTracking } from '../location/locationService';

/**
 * Dismiss alarm from background (notification action button, etc.)
 * Stops sound/vibration, clears notifications, and completes the alarm in DB.
 */
export async function dismissAlarmFromBackground(alarmId?: number | null): Promise<void> {
    console.log('[AlarmDismissService] Dismissing alarm from background, alarmId:', alarmId);

    // 1) Stop sound + vibration
    try {
        await stopBackgroundAlarm();
    } catch (err) {
        console.warn('[AlarmDismissService] Failed to stop background alarm:', err);
    }

    // 2) Clear all notifications
    try {
        await clearAllAlarmNotifications();
    } catch (err) {
        console.warn('[AlarmDismissService] Failed to clear notifications:', err);
    }

    // 3) Complete alarm in DB if we have an ID
    if (alarmId) {
        try {
            await useAlarmStore.getState().completeAlarm(alarmId);
        } catch (err) {
            console.warn('[AlarmDismissService] Failed to complete alarm:', err);
        }
    }

    // 4) Stop location tracking
    try {
        await stopAllTracking();
    } catch (err) {
        console.warn('[AlarmDismissService] Failed to stop tracking:', err);
    }

    console.log('[AlarmDismissService] Alarm dismissed from background');
}

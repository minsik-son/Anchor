/**
 * Android Full Screen Notification Module
 *
 * Bridge to send full-screen intent notifications on Android.
 * On Android, arrival notifications use fullScreenIntent to show
 * the alarm-trigger screen directly over the lock screen.
 *
 * On iOS, this module is a no-op (iOS uses notification categories instead).
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AlarmSoundKey } from '../../stores/alarmSettingsStore';
import i18n from '../../i18n';

const CHANNEL_ID = 'locaalert-arrival';

/**
 * Send a high-priority arrival notification on Android.
 *
 * Android's notification system with MAX importance and the fullScreenIntent
 * permission will cause the notification to appear as a heads-up notification
 * that fills the screen when the device is locked.
 *
 * Combined with the MainActivity's showWhenLocked/turnScreenOn flags,
 * tapping the notification (or the heads-up auto-expanding) will launch
 * the alarm-trigger screen over the lock screen.
 */
export async function sendAndroidFullScreenNotification(
    alarmTitle: string,
    alarmId?: number,
    soundKey: AlarmSoundKey = 'alert',
): Promise<string | null> {
    if (Platform.OS !== 'android') return null;

    const displayTitle = alarmTitle || i18n.t('notification.arrival.defaultPlace');

    try {
        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title: i18n.t('notification.arrival.title'),
                subtitle: displayTitle,
                body: i18n.t('notification.arrival.body'),
                sound: `${soundKey}.wav`,
                data: {
                    type: 'arrival',
                    alarmId: alarmId ?? null,
                    screen: '/alarm-trigger',
                },
                categoryIdentifier: 'ARRIVAL_ALARM',
                ...(Platform.OS === 'android' && {
                    channelId: CHANNEL_ID,
                    priority: 'max',
                    sticky: true,
                }),
            },
            trigger: null,
        });

        console.log('[AndroidFullScreen] Sent full-screen notification:', notificationId);
        return notificationId;
    } catch (err) {
        console.warn('[AndroidFullScreen] Failed to send notification:', err);
        return null;
    }
}

/**
 * LocaAlert Notification Service
 *
 * Handles local notifications for alarm triggers, especially when
 * the app is in the background or terminated.
 *
 * Flow:
 *   1. locationService detects geofence entry
 *   2. sendArrivalNotification() fires a local notification immediately
 *   3. If app is in foreground → also navigates to alarm-trigger screen
 *   4. If app is in background → user sees system notification → taps → alarm-trigger screen
 */

import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import { router } from 'expo-router';
import { AlarmSoundKey } from '../../stores/alarmSettingsStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNEL_ID = 'locaalert-arrival';
const CHANNEL_NAME = 'Arrival Alarms';

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Set up notification handler and Android channel.
 * Call once at app startup (e.g. in _layout.tsx).
 */
export async function initNotifications(): Promise<void> {
    // How to display notifications when app is in foreground
    Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
            const data = notification.request.content.data;

            // Suppress tracking update notifications in foreground (dashboard already shows this)
            if (data?.type === 'tracking') {
                return {
                    shouldShowAlert: false,
                    shouldShowBanner: false,
                    shouldShowList: false,
                    shouldPlaySound: false,
                    shouldSetBadge: false,
                    priority: Notifications.AndroidNotificationPriority.LOW,
                };
            }

            // All other notifications (arrival, etc.) show normally
            return {
                shouldShowAlert: true,
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                priority: Notifications.AndroidNotificationPriority.MAX,
            };
        },
    });

    // Android: create a high-importance notification channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: CHANNEL_NAME,
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 250, 500],
            sound: 'default',
            enableLights: true,
            lightColor: '#3182F6',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
    }

    console.log('[NotificationService] Initialized');
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

/**
 * Request notification permission from the user.
 * Returns true if permission was granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync({
        ios: {
            allowAlert: true,
            allowSound: true,
            allowBadge: false,
            allowCriticalAlerts: true,
        },
    });

    console.log('[NotificationService] Permission status:', status);
    return status === 'granted';
}

// ---------------------------------------------------------------------------
// Send Notification
// ---------------------------------------------------------------------------

/**
 * Fire an immediate local notification when the user arrives at a destination.
 * Works in both foreground and background.
 */
export async function sendArrivalNotification(
    alarmTitle: string,
    alarmId?: number,
    soundKey: AlarmSoundKey = 'alert',
): Promise<string> {
    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: '🔔 목적지 도착!',
            body: alarmTitle
                ? `${alarmTitle}에 도착했습니다.`
                : '설정한 목적지에 도착했습니다.',
            sound: `${soundKey}.wav`,
            data: {
                type: 'arrival',
                alarmId: alarmId ?? null,
                screen: '/alarm-trigger',
            },
            ...(Platform.OS === 'ios' && {
                interruptionLevel: 'critical',
            }),
            ...(Platform.OS === 'android' && {
                channelId: CHANNEL_ID,
                priority: 'max',
                sticky: true,
            }),
        },
        trigger: null, // Immediate
    });

    console.log('[NotificationService] Sent arrival notification:', notificationId);
    return notificationId;
}

/**
 * Send a tracking notification showing distance and elapsed time for lock screen.
 * Called every 30 seconds during ADAPTIVE_POLLING and ACTIVE_TRACKING phases.
 */
export async function sendTrackingNotification(
    distanceMeters: number,
    elapsedSeconds: number,
    alarmId: number,
    alarmTitle: string,
): Promise<void> {
    const distanceStr = distanceMeters < 1000
        ? `${Math.round(distanceMeters)}m`
        : `${(distanceMeters / 1000).toFixed(1)}km`;

    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    let timeStr: string;
    if (hours > 0) {
        timeStr = `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
        timeStr = `${minutes}분 ${seconds}초`;
    } else {
        timeStr = `${seconds}초`;
    }

    await Notifications.scheduleNotificationAsync({
        content: {
            title: `📍 ${alarmTitle} · 남은 거리 ${distanceStr}`,
            body: `⏱ 경과 시간 ${timeStr}`,
            sound: false,
            data: {
                type: 'tracking',
                alarmId,
            },
            ...(Platform.OS === 'android' && {
                channelId: CHANNEL_ID,
                priority: 'high',
                sticky: true,
            }),
        },
        trigger: null,
        identifier: 'tracking-update',
    });
}

/**
 * Clear the tracking notification from the lock screen.
 */
export async function clearTrackingNotification(): Promise<void> {
    try {
        await Notifications.dismissNotificationAsync('tracking-update');
    } catch {
    }
}

// ---------------------------------------------------------------------------
// Notification Response Handler
// ---------------------------------------------------------------------------

let responseSubscription: Notifications.Subscription | null = null;

/**
 * Register a listener for when the user taps a notification.
 * Navigates to the alarm-trigger screen.
 * Call once at app startup.
 */
export function setupNotificationResponseHandler(): void {
    // Clean up any existing subscription
    if (responseSubscription) {
        responseSubscription.remove();
    }

    responseSubscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
            const data = response.notification.request.content.data;
            console.log('[NotificationService] Notification tapped:', data);

            if (data?.screen === '/alarm-trigger') {
                // Small delay to ensure navigation context is ready
                // (especially when app was terminated/backgrounded)
                // Use navigate instead of push to prevent stacking multiple modal instances
                setTimeout(() => {
                    router.navigate('/alarm-trigger');
                }, 300);
            }
        },
    );

    console.log('[NotificationService] Response handler registered');
}

/**
 * Clean up the notification response listener.
 */
export function removeNotificationResponseHandler(): void {
    if (responseSubscription) {
        responseSubscription.remove();
        responseSubscription = null;
    }
}

// ---------------------------------------------------------------------------
// Utility: Check if app is in foreground
// ---------------------------------------------------------------------------

/**
 * Returns true if the app is currently in the foreground (active state).
 */
export function isAppInForeground(): boolean {
    return AppState.currentState === 'active';
}

// ---------------------------------------------------------------------------
// Clear arrival notifications (after user dismisses alarm)
// ---------------------------------------------------------------------------

/**
 * Dismiss all pending arrival notifications.
 * Call when user dismisses the alarm.
 */
export async function clearArrivalNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
}

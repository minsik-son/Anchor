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
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            priority: Notifications.AndroidNotificationPriority.MAX,
        }),
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
): Promise<string> {
    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: '🔔 목적지 도착!',
            body: alarmTitle
                ? `${alarmTitle}에 도착했습니다.`
                : '설정한 목적지에 도착했습니다.',
            sound: 'default',
            data: {
                type: 'arrival',
                alarmId: alarmId ?? null,
                screen: '/alarm-trigger',
            },
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
                setTimeout(() => {
                    router.push('/alarm-trigger');
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

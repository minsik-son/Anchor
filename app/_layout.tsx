/**
 * LocaAlert Root Layout
 * Expo Router configuration with database initialization
 */

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'react-native';
import { initDatabase } from '../src/db/database';
import * as db from '../src/db/database';
import { colors as defaultColors, useThemeColors } from '../src/styles/theme';
import { useThemeStore } from '../src/stores/themeStore';
import { useChallengeStore } from '../src/stores/challengeStore';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useLocationStore } from '../src/stores/locationStore';
import {
    initNotifications,
    setupNotificationResponseHandler,
    removeNotificationResponseHandler,
} from '../src/services/notification/notificationService';
import * as Sentry from '@sentry/react-native';
import { OfflineBanner } from '../src/components/common/OfflineBanner';
import { cleanExpiredData } from '../src/services/privacy/dataRetentionService';
import '../src/i18n'; // Initialize i18n

// Initialize Sentry (production only)
Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
    attachScreenshot: true,
    enableAutoSessionTracking: true,
});

export default function RootLayout() {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const colors = useThemeColors();
    const mode = useThemeStore((state) => state.mode);
    const systemScheme = useColorScheme();

    // Determine status bar style based on theme
    const statusBarStyle = mode === 'system' ? 'auto' : (mode === 'dark' ? 'light' : 'dark');

    useEffect(() => {
        async function initialize() {
            try {
                await initDatabase();

                // Load stores — wrap each in try/catch so one failure doesn't block the app
                try {
                    await useAlarmStore.getState().loadActiveAlarm();
                } catch (alarmErr) {
                    console.warn('[RootLayout] Failed to load active alarm (non-fatal):', alarmErr);
                }

                // Crash recovery: restore route history from checkpoint
                try {
                    const activeSession = await db.getActiveTrackingSession();
                    if (activeSession) {
                        const routePoints = JSON.parse(activeSession.route_points);
                        if (routePoints.length > 0) {
                            useLocationStore.getState().restoreRouteHistory(
                                routePoints,
                                activeSession.traveled_distance
                            );
                            console.log(`[RootLayout] Restored ${routePoints.length} route points from checkpoint`);
                        }
                    }
                } catch (recoveryErr) {
                    console.warn('[RootLayout] Crash recovery failed (non-fatal):', recoveryErr);
                }

                try {
                    await useChallengeStore.getState().loadChallenges();
                } catch (challengeErr) {
                    console.warn('[RootLayout] Failed to load challenges (non-fatal):', challengeErr);
                }

                try {
                    await initNotifications();
                } catch (notifErr) {
                    console.warn('[RootLayout] Failed to init notifications (non-fatal):', notifErr);
                }

                // Run periodic data cleanup
                try {
                    await cleanExpiredData();
                } catch (cleanupErr) {
                    console.warn('[RootLayout] Data cleanup failed (non-fatal):', cleanupErr);
                }

                setIsReady(true);
            } catch (err) {
                console.error('[RootLayout] Database initialization failed:', err);
                setError((err as Error).message);
            }
        }
        initialize();
    }, []);

    // Set up notification tap handler
    useEffect(() => {
        if (!isReady) return;
        setupNotificationResponseHandler();
        return () => removeNotificationResponseHandler();
    }, [isReady]);

    // Reload challenges when app returns to foreground
    useEffect(() => {
        if (!isReady) return;

        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                useChallengeStore.getState().loadChallenges();
                useAlarmStore.getState().loadActiveAlarm();
            }
        });

        return () => subscription.remove();
    }, [isReady]);

    if (!isReady) {
        return (
            <View style={[styles.loading, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <StatusBar style={statusBarStyle} />
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={styles.container}>
            <OfflineBanner />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    animation: 'slide_from_right',
                }}
            >
                <Stack.Screen name="index" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                    name="alarm-trigger"
                    options={{
                        animation: 'fade',
                        gestureEnabled: false,
                    }}
                />
                <Stack.Screen name="alarm-setup" />
                <Stack.Screen name="alarm-detail" />
                <Stack.Screen name="activity-stats" />
                <Stack.Screen name="challenge-landing" options={{ headerShown: false }} />
                <Stack.Screen name="challenge-create" options={{ headerShown: false }} />
                <Stack.Screen name="challenge-detail" options={{ headerShown: false }} />
                <Stack.Screen name="challenge-location-picker" options={{ headerShown: false }} />
                {__DEV__ && <Stack.Screen name="dev-debug" options={{ headerShown: false }} />}
                <Stack.Screen
                    name="action-checklist"
                    options={{
                        animation: 'slide_from_bottom',
                        gestureEnabled: false,
                        presentation: 'transparentModal',
                        contentStyle: { backgroundColor: 'transparent' },
                    }}
                />
                <Stack.Screen
                    name="alarm-completion"
                    options={{
                        animation: 'fade',
                        gestureEnabled: false,
                    }}
                />
                <Stack.Screen
                    name="tracking-detail"
                    options={{
                        animation: 'slide_from_bottom',
                        gestureEnabled: true,
                        headerShown: false,
                    }}
                />
                <Stack.Screen
                    name="interstitial-ad"
                    options={{
                        animation: 'none',
                        gestureEnabled: false,
                    }}
                />
                <Stack.Screen
                    name="background-picker"
                    options={{
                        headerShown: false,
                        animation: 'slide_from_right',
                    }}
                />
            </Stack>
            <StatusBar style={statusBarStyle} />
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

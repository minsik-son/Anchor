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
import { colors as defaultColors, useThemeColors } from '../src/styles/theme';
import { useThemeStore } from '../src/stores/themeStore';
import { useRoutineStore } from '../src/stores/routineStore';
import { evaluate } from '../src/services/routineManager';
import { registerLocationTickCallback } from '../src/services/location/locationService';
import '../src/i18n'; // Initialize i18n

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
                await useRoutineStore.getState().loadRoutines();
                setIsReady(true);
            } catch (err) {
                console.error('[RootLayout] Initialization failed:', err);
                setError((err as Error).message);
            }
        }
        initialize();
    }, []);

    // Routine evaluation: foreground + background location ticks
    useEffect(() => {
        if (!isReady) return;

        registerLocationTickCallback(() => evaluate());
        evaluate();

        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') evaluate();
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
                        presentation: 'fullScreenModal',
                        animation: 'fade',
                    }}
                />
                <Stack.Screen name="alarm-setup" />
                <Stack.Screen name="alarm-detail" />
                <Stack.Screen name="routine-setup" options={{ headerShown: false }} />
                <Stack.Screen
                    name="action-checklist"
                    options={{
                        animation: 'slide_from_bottom',
                        gestureEnabled: false,
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

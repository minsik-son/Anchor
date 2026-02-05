/**
 * LocaAlert Root Layout
 * Expo Router configuration with database initialization
 */

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase } from '../src/db/database';
import { colors } from '../src/styles/theme';
import '../src/i18n'; // Initialize i18n

export default function RootLayout() {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function initialize() {
            try {
                await initDatabase();
                setIsReady(true);
            } catch (err) {
                console.error('[RootLayout] Initialization failed:', err);
                setError((err as Error).message);
            }
        }
        initialize();
    }, []);

    if (!isReady) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <StatusBar style="dark" />
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
            </Stack>
            <StatusBar style="dark" />
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
        backgroundColor: colors.background,
    },
});

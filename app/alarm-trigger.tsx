/**
 * LocaAlert Alarm Trigger Screen
 * Full-screen alarm when user arrives at destination
 */

import { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useLocationStore } from '../src/stores/locationStore';
import { colors as defaultColors, typography, spacing, radius, useThemeColors, ThemeColors } from '../src/styles/theme';

export default function AlarmTrigger() {
    const params = useLocalSearchParams<{ alarmId: string }>();
    const [slideValue] = useState(new Animated.Value(0));
    const { activeAlarm, deactivateAlarm } = useAlarmStore();
    const { stopTracking } = useLocationStore();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        // Trigger haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(slideValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(slideValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const handleDismiss = async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (activeAlarm) {
            await deactivateAlarm(activeAlarm.id);
        }

        stopTracking();
        router.back();
    };

    const scale = slideValue.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.1],
    });

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Main Content */}
            <View style={styles.content}>
                <Animated.View style={[styles.iconContainer, { transform: [{ scale }] }]}>
                    <Ionicons name="checkmark-circle" size={120} color={colors.surface} />
                </Animated.View>

                <Text style={styles.title}>목적지에 도착했어요!</Text>

                {activeAlarm && (
                    <Text style={styles.subtitle}>{activeAlarm.title}</Text>
                )}
            </View>

            {/* Slide to Dismiss */}
            <View style={styles.dismissContainer}>
                <Pressable
                    style={({ pressed }) => [
                        styles.dismissButton,
                        pressed && styles.dismissButtonPressed,
                    ]}
                    onPress={handleDismiss}
                    onLongPress={handleDismiss}
                >
                    <Ionicons name="arrow-forward" size={24} color={colors.error} />
                    <Text style={styles.dismissText}>밀어서 알람 끄기</Text>
                </Pressable>

                <Text style={styles.dismissHint}>또는 터치하여 끄기</Text>
            </View>

            {/* Background Gradient Effect */}
            <View style={styles.backgroundGradient} />
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.error,
    },
    backgroundGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    iconContainer: {
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.display,
        fontSize: 32,
        color: colors.surface,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.heading,
        color: colors.surface,
        textAlign: 'center',
        opacity: 0.9,
    },
    dismissContainer: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.lg * 2,
        alignItems: 'center',
    },
    dismissButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
    },
    dismissButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    dismissText: {
        ...typography.body,
        color: colors.error,
        fontWeight: '700',
    },
    dismissHint: {
        ...typography.caption,
        color: colors.surface,
        marginTop: spacing.sm,
        opacity: 0.7,
    },
});

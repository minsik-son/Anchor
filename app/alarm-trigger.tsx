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
import { useTranslation } from 'react-i18next';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useLocationStore } from '../src/stores/locationStore';
import { colors as defaultColors, typography, spacing, radius, useThemeColors, ThemeColors } from '../src/styles/theme';

export default function AlarmTrigger() {
    const params = useLocalSearchParams<{ alarmId: string }>();
    const [slideValue] = useState(new Animated.Value(0));
    const { activeAlarm, deactivateAlarm, loadMemos, currentMemos, toggleMemoChecked } = useAlarmStore();
    const { stopTracking } = useLocationStore();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        if (activeAlarm) {
            loadMemos(activeAlarm.id);
        }
    }, [activeAlarm]);

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

                <Text style={styles.title}>{t('alarmTrigger.arrived')}</Text>

                {activeAlarm && (
                    <Text style={styles.subtitle}>{activeAlarm.title}</Text>
                )}

                {/* Checklist */}
                {currentMemos.length > 0 && (
                    <View style={styles.checklistContainer}>
                        <Text style={styles.checklistTitle}>{t('alarmTrigger.checklist')}</Text>
                        {currentMemos.map((memo) => (
                            <Pressable
                                key={memo.id}
                                style={styles.checklistItem}
                                onPress={() => toggleMemoChecked(memo.id, !memo.is_checked)}
                            >
                                <Ionicons
                                    name={memo.is_checked ? 'checkbox' : 'square-outline'}
                                    size={22}
                                    color={colors.surface}
                                />
                                <Text style={[
                                    styles.checklistText,
                                    memo.is_checked && styles.checklistTextDone,
                                ]}>
                                    {memo.content}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
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
                    <Text style={styles.dismissText}>{t('alarmTrigger.dismiss')}</Text>
                </Pressable>

                <Text style={styles.dismissHint}>{t('alarmTrigger.dismissHint')}</Text>
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
    checklistContainer: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: radius.md,
        padding: spacing.sm,
        marginTop: spacing.md,
        width: '100%',
        maxWidth: 300,
    },
    checklistTitle: {
        ...typography.caption,
        color: colors.surface,
        fontWeight: '600',
        marginBottom: spacing.xs,
        opacity: 0.8,
    },
    checklistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: 6,
    },
    checklistText: {
        ...typography.body,
        color: colors.surface,
        flex: 1,
    },
    checklistTextDone: {
        opacity: 0.6,
        textDecorationLine: 'line-through',
    },
});

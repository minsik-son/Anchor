/**
 * LocaAlert Alarm Trigger Screen
 * Full-screen alarm with slide-to-dismiss gesture, sound, and vibration
 */

import { useMemo, useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withSequence,
    withTiming,
    runOnJS,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useLocationStore } from '../src/stores/locationStore';
import { useAlarmSettingsStore } from '../src/stores/alarmSettingsStore';
import { useAlarmSound } from '../src/hooks/useAlarmSound';
import { useAlarmVibration } from '../src/hooks/useAlarmVibration';
import { typography, spacing, radius, useThemeColors, ThemeColors } from '../src/styles/theme';

const THUMB_WIDTH = 64;
const DISMISS_THRESHOLD = 0.85;

export default function AlarmTrigger() {
    const { activeAlarm, deactivateAlarm, loadMemos, currentMemos, toggleMemoChecked } = useAlarmStore();
    const { stopTracking } = useLocationStore();
    const { alertType, selectedSound } = useAlarmSettingsStore();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { play, stop: stopSound } = useAlarmSound({ loop: true });
    const { startLoop, stopLoop } = useAlarmVibration();

    const [trackWidth, setTrackWidth] = useState(0);
    const translateX = useSharedValue(0);
    const pulseScale = useSharedValue(1);

    const maxSlide = trackWidth > 0 ? trackWidth - THUMB_WIDTH : 0;

    useEffect(() => {
        if (activeAlarm) {
            loadMemos(activeAlarm.id);
        }
    }, [activeAlarm]);

    // Start sound and vibration based on settings
    useEffect(() => {
        const shouldPlaySound = alertType === 'both' || alertType === 'sound';
        const shouldVibrate = alertType === 'both' || alertType === 'vibration';

        if (shouldPlaySound) {
            play(selectedSound);
        }
        if (shouldVibrate) {
            startLoop();
        }

        return () => {
            stopSound();
            stopLoop();
        };
    }, []);

    // Pulse animation
    useEffect(() => {
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const handleDismiss = useCallback(async () => {
        await stopSound();
        stopLoop();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (activeAlarm) {
            await deactivateAlarm(activeAlarm.id);
        }
        stopTracking();
        router.back();
    }, [activeAlarm, deactivateAlarm, stopTracking, stopSound, stopLoop]);

    const onDismissJS = useCallback(() => {
        handleDismiss();
    }, [handleDismiss]);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            const clamped = Math.max(0, Math.min(event.translationX, maxSlide));
            translateX.value = clamped;
        })
        .onEnd(() => {
            if (maxSlide > 0 && translateX.value >= maxSlide * DISMISS_THRESHOLD) {
                translateX.value = withSpring(maxSlide, { damping: 15 });
                runOnJS(onDismissJS)();
            } else {
                translateX.value = withSpring(0, { damping: 15 });
            }
        });

    const thumbAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const labelAnimatedStyle = useAnimatedStyle(() => {
        const opacity = maxSlide > 0
            ? interpolate(translateX.value, [0, maxSlide * 0.5], [1, 0], 'clamp')
            : 1;
        return { opacity };
    });

    const iconPulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
        setTrackWidth(event.nativeEvent.layout.width);
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <View style={styles.content}>
                <Animated.View style={[styles.iconContainer, iconPulseStyle]}>
                    <Ionicons name="checkmark-circle" size={120} color={colors.surface} />
                </Animated.View>

                <Text style={styles.title}>{t('alarmTrigger.arrived')}</Text>

                {activeAlarm && (
                    <Text style={styles.subtitle}>{activeAlarm.title}</Text>
                )}

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
                <View style={styles.sliderTrack} onLayout={handleTrackLayout}>
                    <Animated.Text style={[styles.sliderLabel, labelAnimatedStyle]}>
                        {t('alarmTrigger.dismiss')}
                    </Animated.Text>

                    <GestureDetector gesture={panGesture}>
                        <Animated.View style={[styles.sliderThumb, thumbAnimatedStyle]}>
                            <Ionicons name="chevron-forward" size={28} color={colors.error} />
                        </Animated.View>
                    </GestureDetector>
                </View>

                <Text style={styles.dismissHint}>{t('alarmTrigger.dismissHint')}</Text>
            </View>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.error,
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
    sliderTrack: {
        width: '100%',
        height: THUMB_WIDTH,
        borderRadius: radius.full,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sliderLabel: {
        ...typography.body,
        color: colors.surface,
        fontWeight: '600',
        position: 'absolute',
    },
    sliderThumb: {
        width: THUMB_WIDTH,
        height: THUMB_WIDTH,
        borderRadius: radius.full,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        left: 0,
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

/**
 * LocaAlert Alarm Trigger Screen
 * Full-screen alarm with slide-to-dismiss gesture, sound, and vibration
 */

import { useMemo, useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutChangeEvent, ImageBackground } from 'react-native';
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
    cancelAnimation,
} from 'react-native-reanimated';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useLocationStore } from '../src/stores/locationStore';
import { useRoutineStore } from '../src/stores/routineStore';
import { useAlarmSettingsStore, ALARM_BACKGROUNDS } from '../src/stores/alarmSettingsStore';
import { useAlarmSound } from '../src/hooks/useAlarmSound';
import { useAlarmVibration } from '../src/hooks/useAlarmVibration';
import { useShakeDetection } from '../src/hooks/useShakeDetection';
import { typography, spacing, radius, useThemeColors, ThemeColors } from '../src/styles/theme';

const THUMB_WIDTH = 64;
const DISMISS_THRESHOLD = 0.85;

export default function AlarmTrigger() {
    const { activeAlarm, completeAlarm, loadMemos, currentMemos } = useAlarmStore();
    const { stopTracking } = useLocationStore();
    const { alertType, selectedSound, shakeToDismiss, backgroundType, selectedPreset, customImageUri } = useAlarmSettingsStore();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { play, stop: stopSound } = useAlarmSound({ loop: true });
    const { startLoop, stopLoop } = useAlarmVibration();

    const backgroundSource = useMemo(() => {
        if (backgroundType === 'preset') return ALARM_BACKGROUNDS[selectedPreset]?.asset;
        if (backgroundType === 'custom' && customImageUri) return { uri: customImageUri };
        return null;
    }, [backgroundType, selectedPreset, customImageUri]);

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
        return () => cancelAnimation(pulseScale);
    }, []);

    const handleDismiss = useCallback(async () => {
        if (!activeAlarm) return;

        const alarmId = activeAlarm.id;
        const alarmTitle = activeAlarm.title;
        const hasMemos = currentMemos.length > 0;

        await stopSound();
        stopLoop();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        await completeAlarm(alarmId);
        stopTracking();

        // Mark routine as fulfilled to prevent re-triggering in the same time window
        const routineState = useRoutineStore.getState();
        if (routineState.activeRoutineId !== null) {
            routineState.markRoutineFulfilled(routineState.activeRoutineId);
            routineState.setActiveRoutineId(null);
        }

        if (hasMemos) {
            router.replace({
                pathname: '/action-checklist',
                params: { alarmId: String(alarmId), alarmTitle },
            });
        } else {
            router.back();
        }
    }, [activeAlarm, currentMemos, completeAlarm, stopTracking, stopSound, stopLoop]);

    useShakeDetection({ enabled: shakeToDismiss, onShake: handleDismiss });

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
                translateX.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) });
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

    const alarmContent = (
        <>
            <StatusBar style="light" />

            <View style={styles.content}>
                <Animated.View style={[styles.iconContainer, iconPulseStyle]}>
                    <Ionicons name="checkmark-circle" size={120} color={colors.surface} />
                </Animated.View>

                <Text style={styles.title}>{t('alarmTrigger.arrived')}</Text>

                {activeAlarm && (
                    <Text style={styles.subtitle}>{activeAlarm.title}</Text>
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
        </>
    );

    if (backgroundSource) {
        return (
            <ImageBackground source={backgroundSource} style={styles.container} resizeMode="cover">
                <View style={styles.overlay}>{alarmContent}</View>
            </ImageBackground>
        );
    }

    return (
        <View style={styles.container}>{alarmContent}</View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.error,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
        textShadowColor: 'rgba(0, 0, 0, 0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    subtitle: {
        ...typography.heading,
        color: colors.surface,
        textAlign: 'center',
        opacity: 0.9,
        textShadowColor: 'rgba(0, 0, 0, 0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
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
        textShadowColor: 'rgba(0, 0, 0, 0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
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
        textShadowColor: 'rgba(0, 0, 0, 0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
});

/**
 * LocaAlert Alarm Trigger Screen
 * Full-screen alarm with ripple animation, glassmorphism slider, and deep dark urgency
 */

import { useMemo, useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, ImageBackground } from 'react-native';
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
    withTiming,
    runOnJS,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useLocationStore } from '../src/stores/locationStore';
import { useAlarmSettingsStore, ALARM_BACKGROUNDS } from '../src/stores/alarmSettingsStore';
import { clearArrivalNotifications } from '../src/services/notification/notificationService';
import { useAlarmSound } from '../src/hooks/useAlarmSound';
import { useAlarmVibration } from '../src/hooks/useAlarmVibration';
import { useShakeDetection } from '../src/hooks/useShakeDetection';
import { typography, spacing, radius, useThemeColors, ThemeColors } from '../src/styles/theme';

const THUMB_WIDTH = 64;
const DISMISS_THRESHOLD = 0.85;
const RIPPLE_COUNT = 3;
const RIPPLE_DURATION = 2500;
const ALARM_DARK_BG = '#121212';

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

    // Ripple shared values
    const ripple0 = useSharedValue(0);
    const ripple1 = useSharedValue(0);
    const ripple2 = useSharedValue(0);

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

    // Ripple animation — 3 staggered rings
    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = [];
        [ripple0, ripple1, ripple2].forEach((val, i) => {
            const delay = (RIPPLE_DURATION / RIPPLE_COUNT) * i;
            timers.push(setTimeout(() => {
                val.value = 0;
                val.value = withRepeat(
                    withTiming(1, { duration: RIPPLE_DURATION, easing: Easing.out(Easing.ease) }),
                    -1, false
                );
            }, delay));
        });
        return () => timers.forEach(clearTimeout);
    }, []);

    const rippleStyle0 = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(ripple0.value, [0, 1], [0.3, 2.5]) }],
        opacity: interpolate(ripple0.value, [0, 0.4, 1], [0.4, 0.2, 0]),
    }));

    const rippleStyle1 = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(ripple1.value, [0, 1], [0.3, 2.5]) }],
        opacity: interpolate(ripple1.value, [0, 0.4, 1], [0.4, 0.2, 0]),
    }));

    const rippleStyle2 = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(ripple2.value, [0, 1], [0.3, 2.5]) }],
        opacity: interpolate(ripple2.value, [0, 0.4, 1], [0.4, 0.2, 0]),
    }));

    const handleDismiss = useCallback(async () => {
        if (!activeAlarm) return;

        const alarmId = activeAlarm.id;
        const alarmTitle = activeAlarm.title;
        const hasMemos = currentMemos.length > 0;

        await stopSound();
        stopLoop();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Clear arrival notification from system tray
        await clearArrivalNotifications();

        await completeAlarm(alarmId);
        stopTracking();

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

    const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
        setTrackWidth(event.nativeEvent.layout.width);
    }, []);

    const alarmContent = (
        <>
            <StatusBar style="light" />

            <View style={styles.content}>
                {/* Ripple rings behind hero text */}
                <View style={styles.rippleContainer}>
                    <Animated.View style={[styles.rippleCircle, rippleStyle0]} />
                    <Animated.View style={[styles.rippleCircle, rippleStyle1]} />
                    <Animated.View style={[styles.rippleCircle, rippleStyle2]} />
                </View>

                {/* "Arrived" pill badge */}
                <View style={styles.arrivedBadge}>
                    <Text style={styles.arrivedBadgeText}>{t('alarmTrigger.arrivedBadge')}</Text>
                </View>

                {/* Hero destination name */}
                {activeAlarm && (
                    <Text style={styles.heroTitle} numberOfLines={3} adjustsFontSizeToFit>
                        {activeAlarm.title}
                    </Text>
                )}
            </View>

            {/* Glassmorphism slider */}
            <View style={styles.dismissContainer}>
                <View style={styles.sliderTrack} onLayout={handleTrackLayout}>
                    <Animated.Text style={[styles.sliderLabel, labelAnimatedStyle]}>
                        {t('alarmTrigger.dismiss')}
                    </Animated.Text>

                    <GestureDetector gesture={panGesture}>
                        <Animated.View style={[styles.sliderThumb, thumbAnimatedStyle]}>
                            <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
                        </Animated.View>
                    </GestureDetector>
                </View>

                {shakeToDismiss && (
                    <Text style={styles.shakeHint}>{t('alarmTrigger.shakeHint')}</Text>
                )}
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
        backgroundColor: ALARM_DARK_BG,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    rippleContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rippleCircle: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    arrivedBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: radius.full,
        paddingHorizontal: 16,
        paddingVertical: 6,
        marginBottom: spacing.md,
    },
    arrivedBadgeText: {
        ...typography.caption,
        color: '#FFFFFF',
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    heroTitle: {
        fontSize: 64,
        fontWeight: '800',
        color: '#FFFFFF',
        lineHeight: 72,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.7)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
    shakeHint: {
        ...typography.caption,
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
        marginTop: spacing.sm,
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
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sliderLabel: {
        ...typography.body,
        color: 'rgba(255, 255, 255, 0.7)',
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
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        left: 0,
    },
});

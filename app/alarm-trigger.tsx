/**
 * LocaAlert Alarm Trigger Screen
 * Full-screen alarm with ripple animation, glassmorphism slider, and deep dark urgency
 */

import { useMemo, useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, ImageBackground } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { stopTrackingActivity } from '../src/services/liveActivity/liveActivityService';
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
import { useAlarmSettingsStore, getBackgroundAsset } from '../src/stores/alarmSettingsStore';
import { clearAllAlarmNotifications } from '../src/services/notification/notificationService';
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
    const insets = useSafeAreaInsets();
    const { activeAlarm, completeAlarm, loadMemos, currentMemos } = useAlarmStore();
    const { stopTracking } = useLocationStore();
    const { alertType, selectedSound, shakeToDismiss, backgroundType, selectedPreset, customImageUri } = useAlarmSettingsStore();
    const { t, i18n } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);

    const { play, stop: stopSound } = useAlarmSound({ loop: true });
    const { startLoop, stopLoop } = useAlarmVibration();

    const backgroundSource = useMemo(() => {
        if (backgroundType === 'preset') {
            const asset = getBackgroundAsset(selectedPreset);
            return asset ?? null;
        }
        if (backgroundType === 'custom' && customImageUri) return { uri: customImageUri };
        return null;
    }, [backgroundType, selectedPreset, customImageUri]);

    const [currentTime, setCurrentTime] = useState(new Date());
    const [trackWidth, setTrackWidth] = useState(0);
    const translateX = useSharedValue(0);
    const thumbScale = useSharedValue(1);
    const shimmerProgress = useSharedValue(0);

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

    // Time update — every minute
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    // Shimmer animation
    useEffect(() => {
        shimmerProgress.value = withRepeat(
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            -1,
            false
        );
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

        // Clear ALL notifications from notification center (arrival + tracking + scheduled)
        await clearAllAlarmNotifications();

        // Stop Live Activity (Dynamic Island)
        await stopTrackingActivity();

        // IMPORTANT: Save route data to DB BEFORE stopping tracking
        // stopTracking() clears routeHistory and traveledDistance from store,
        // so completeAlarm() must read them first.
        await completeAlarm(alarmId);

        // Now safe to stop tracking (route data already persisted to DB)
        stopTracking();

        if (hasMemos) {
            router.replace({
                pathname: '/action-checklist',
                params: { alarmId: String(alarmId), alarmTitle },
            });
        } else {
            router.replace('/alarm-completion');
        }
    }, [activeAlarm, currentMemos, completeAlarm, stopTracking, stopSound, stopLoop]);

    useShakeDetection({ enabled: shakeToDismiss, onShake: handleDismiss });

    const onDismissJS = useCallback(() => {
        handleDismiss();
    }, [handleDismiss]);

    const panGesture = Gesture.Pan()
        .onStart(() => {
            thumbScale.value = withSpring(1.1, { damping: 15, stiffness: 300 });
        })
        .onUpdate((event) => {
            const clamped = Math.max(0, Math.min(event.translationX, maxSlide));
            translateX.value = clamped;
        })
        .onEnd(() => {
            thumbScale.value = withSpring(1, { damping: 15, stiffness: 300 });
            if (maxSlide > 0 && translateX.value >= maxSlide * DISMISS_THRESHOLD) {
                translateX.value = withSpring(maxSlide, { damping: 15 });
                runOnJS(onDismissJS)();
            } else {
                translateX.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) });
            }
        });

    const thumbAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { scale: thumbScale.value },
        ],
    }));

    const labelAnimatedStyle = useAnimatedStyle(() => {
        const opacity = maxSlide > 0
            ? interpolate(translateX.value, [0, maxSlide * 0.5], [1, 0], 'clamp')
            : 1;
        return { opacity };
    });

    const chevronAnimStyle = (index: number) => useAnimatedStyle(() => {
        const baseX = 80 + index * 20;
        const translateXVal = interpolate(shimmerProgress.value, [0, 1], [0, 30]);
        const opacity = interpolate(shimmerProgress.value, [0, 0.3, 0.7, 1], [0.2, 0.6, 0.6, 0.2]);
        return {
            transform: [{ translateX: baseX + translateXVal }],
            opacity,
        };
    });

    const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
        setTrackWidth(event.nativeEvent.layout.width);
    }, []);

    const timeString = currentTime.toLocaleTimeString(i18n.language, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const dateString = currentTime.toLocaleDateString(i18n.language, {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
    });

    const alarmContent = (
        <>
            <StatusBar style="light" />

            {/* Top Section: Time + Date */}
            <View style={styles.topSection}>
                <Text style={styles.timeText} accessibilityRole="text">{timeString}</Text>
                <Text style={styles.dateText} accessibilityRole="text">{dateString}</Text>
            </View>

            {/* Center Section: Arrival message with ripple background */}
            <View style={styles.centerSection}>
                {/* Ripple rings behind */}
                <View style={styles.rippleContainer}>
                    <Animated.View style={[styles.rippleCircle, rippleStyle0]} />
                    <Animated.View style={[styles.rippleCircle, rippleStyle1]} />
                    <Animated.View style={[styles.rippleCircle, rippleStyle2]} />
                </View>

                {/* Home icon + arrival text */}
                <Ionicons
                    name="home"
                    size={32}
                    color="rgba(255, 255, 255, 0.85)"
                    style={styles.arrivalIcon}
                    accessibilityRole="image"
                    accessibilityLabel={t('alarmTrigger.arrivedBadge')}
                />
                {activeAlarm && (
                    <Text
                        style={styles.arrivalText}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        accessibilityRole="header"
                        accessibilityLabel={t('alarmTrigger.arrivedAt', { place: activeAlarm.title })}
                    >
                        {t('alarmTrigger.arrivedAt', { place: activeAlarm.title })}
                    </Text>
                )}
            </View>

            {/* Bottom Section: Slider */}
            <View
                style={styles.bottomSection}
                accessibilityRole="adjustable"
                accessibilityLabel={t('accessibility.slideToDismiss')}
                accessibilityHint={t('alarmTrigger.dismissHint')}
            >
                <View style={styles.sliderTrack} onLayout={handleTrackLayout}>
                    {/* Shimmer chevrons */}
                    {[0, 1, 2].map((i) => (
                        <Animated.View key={i} style={[styles.shimmerChevron, chevronAnimStyle(i)]}>
                            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
                        </Animated.View>
                    ))}

                    <Animated.Text style={[styles.sliderLabel, labelAnimatedStyle]}>
                        {t('alarmTrigger.dismiss')}
                    </Animated.Text>

                    <GestureDetector gesture={panGesture}>
                        <Animated.View
                            style={[styles.sliderThumb, thumbAnimatedStyle]}
                            accessibilityRole="button"
                            accessibilityLabel={t('accessibility.dismissAlarm')}
                        >
                            <Ionicons name="arrow-forward" size={24} color={colors.primary} />
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

const createStyles = (colors: ThemeColors, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: ALARM_DARK_BG,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    topSection: {
        paddingTop: insets.top + 20,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
    },
    timeText: {
        fontSize: 72,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        letterSpacing: -2,
        fontVariant: ['tabular-nums'],
    },
    dateText: {
        fontSize: 17,
        fontWeight: '400',
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
        marginTop: 4,
    },
    centerSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
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
    arrivalIcon: {
        marginBottom: 12,
    },
    arrivalText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
        lineHeight: 34,
        textShadowColor: 'rgba(0, 0, 0, 0.7)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
    bottomSection: {
        paddingHorizontal: spacing.md,
        paddingBottom: insets.bottom + spacing.lg,
        alignItems: 'center',
    },
    sliderTrack: {
        width: '100%',
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    shimmerChevron: {
        position: 'absolute',
        left: 0,
    },
    sliderLabel: {
        ...typography.body,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '600',
        position: 'absolute',
        right: '40%',
        textShadowColor: 'rgba(0, 0, 0, 0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    sliderThumb: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        left: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    shakeHint: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.5)',
        textAlign: 'center',
        marginTop: 12,
        fontWeight: '400',
    },
});

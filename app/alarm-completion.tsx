/**
 * LocaAlert Alarm Completion Screen
 * Celebration screen with animated checkmark, auto-dismisses to ad
 */

import { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
} from 'react-native-reanimated';
import { typography, spacing } from '../src/styles/theme';

const ALARM_DARK_BG = '#121212';
const CIRCLE_COLOR = '#3182F6'; // Toss Blue

export default function AlarmCompletion() {
    const { t } = useTranslation();

    // Only checkmark animates — circle is always visible
    const checkScale = useSharedValue(0);
    const checkOpacity = useSharedValue(0);

    useEffect(() => {
        // Checkmark: single decisive appearance — no bounce, just "tudum"
        checkScale.value = withDelay(
            300,
            withTiming(1, { duration: 250, easing: Easing.out(Easing.back(1.3)) })
        );
        checkOpacity.value = withDelay(
            300,
            withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) })
        );

        // Haptic feedback when checkmark appears
        setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 400);

        // Auto-navigate after 2.5s
        const timer = setTimeout(() => {
            navigateToAd();
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    const navigateToAd = useCallback(() => {
        router.replace('/interstitial-ad');
    }, []);

    const checkAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: checkScale.value }],
        opacity: checkOpacity.value,
    }));

    return (
        <Pressable style={styles.container} onPress={navigateToAd}>
            <StatusBar style="light" />

            <View style={styles.circleContainer}>
                <Animated.View style={checkAnimStyle}>
                    <Ionicons name="checkmark" size={56} color="#FFFFFF" />
                </Animated.View>
            </View>

            <Text style={styles.title}>{t('alarmCompletion.title')}</Text>
            <Text style={styles.subtitle}>{t('alarmCompletion.subtitle')}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: ALARM_DARK_BG,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    circleContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: CIRCLE_COLOR,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: CIRCLE_COLOR,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 8,
    },
    title: {
        ...typography.display,
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        marginTop: spacing.lg,
        textAlign: 'center',
    },
    subtitle: {
        ...typography.body,
        color: 'rgba(255, 255, 255, 0.7)',
        marginTop: spacing.xs,
        textAlign: 'center',
    },
});

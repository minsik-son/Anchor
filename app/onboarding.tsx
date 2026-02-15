/**
 * LocaAlert Onboarding Screen
 * Permission request with persuasive UI (Toss style)
 */

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { requestNotificationPermission } from '../src/services/notification/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as defaultColors, typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';
import { useTranslation } from 'react-i18next';

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

export default function Onboarding() {
    const insets = useSafeAreaInsets();
    const [isLoading, setIsLoading] = useState(false);
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleStart = async () => {
        setIsLoading(true);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // Request foreground permission first
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

            if (foregroundStatus !== 'granted') {
                Alert.alert(
                    t('onboarding.permissions.location'),
                    t('onboarding.permissions.locationDesc'),
                    [{ text: t('common.confirm') }]
                );
                setIsLoading(false);
                return;
            }

            // Request background permission
            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

            if (backgroundStatus !== 'granted') {
                Alert.alert(
                    t('onboarding.permissions.background'),
                    t('onboarding.permissions.backgroundDesc'),
                    [
                        { text: t('onboarding.later'), onPress: () => completeOnboarding() },
                        { text: t('onboarding.toSettings'), onPress: () => Location.enableNetworkProviderAsync() },
                    ]
                );
                return;
            }

            // Request notification permission (non-blocking — proceed even if denied)
            await requestNotificationPermission();

            await completeOnboarding();
        } catch (error: any) {
            console.error('[Onboarding] Permission request failed:', error);

            // Handle Expo Go environment where Info.plist keys may not be available
            if (error?.message?.includes('NSLocation') || error?.message?.includes('Info.plist')) {
                Alert.alert(
                    t('onboarding.expoGo.title'),
                    t('onboarding.expoGo.message'),
                    [
                        { text: t('onboarding.expoGo.cancel'), onPress: () => setIsLoading(false) },
                        { text: t('onboarding.expoGo.continue'), onPress: () => completeOnboarding() },
                    ]
                );
            } else {
                Alert.alert(t('common.error'), t('onboarding.permissionFailed'));
                setIsLoading(false);
            }
        }
    };

    const completeOnboarding = async () => {
        await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)/home');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Illustration Area */}
            <View style={styles.illustrationContainer}>
                <View style={styles.illustrationCircle}>
                    <Text style={styles.illustrationEmoji}>📍</Text>
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.title}>{t('onboarding.welcome')}</Text>
                <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
            </View>

            {/* Features */}
            <View style={styles.features}>
                <FeatureItem icon="🔋" text={t('onboarding.features.battery')} styles={styles} />
                <FeatureItem icon="🎯" text={t('onboarding.features.location')} styles={styles} />
                <FeatureItem icon="📝" text={t('onboarding.features.checklist')} styles={styles} />
            </View>

            {/* CTA Button */}
            <View style={styles.ctaContainer}>
                <Pressable
                    style={({ pressed }) => [
                        styles.ctaButton,
                        pressed && styles.ctaButtonPressed,
                    ]}
                    onPress={handleStart}
                    disabled={isLoading}
                >
                    <Text style={styles.ctaText}>
                        {isLoading ? t('onboarding.requesting') : t('onboarding.start')}
                    </Text>
                </Pressable>

                <Text style={styles.permissionNote}>
                    {t('onboarding.permissionNote')}
                </Text>
            </View>
            <Text style={styles.permissionNote}>
                {t('onboarding.permissions.locationDesc')}
            </Text>
        </View>
    );
}

function FeatureItem({ icon, text, styles }: { icon: string; text: string; styles: any }) {
    return (
        <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>{icon}</Text>
            <Text style={styles.featureText}>{text}</Text>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.md,
    },
    illustrationContainer: {
        flex: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    illustrationCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.card,
    },
    illustrationEmoji: {
        fontSize: 64,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        ...typography.display,
        color: colors.textStrong,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: colors.textMedium,
        textAlign: 'center',
        lineHeight: 24,
    },
    features: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        marginVertical: spacing.md,
    },
    featureItem: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        ...shadows.button,
    },
    featureIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    featureText: {
        ...typography.caption,
        color: colors.textMedium,
    },
    ctaContainer: {
        paddingVertical: spacing.lg,
    },
    ctaButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        alignItems: 'center',
        ...shadows.button,
    },
    ctaButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    ctaText: {
        ...typography.heading,
        color: colors.surface,
    },
    permissionNote: {
        ...typography.caption,
        color: colors.textWeak,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
});

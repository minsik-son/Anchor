/**
 * LocaAlert Activity Screen
 * Pedometer-based step dashboard with calorie tracking and motivational messages
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { usePedometer } from '../../src/hooks/usePedometer';
import { useActivityStore } from '../../src/stores/activityStore';
import { getActiveMessages, MessageContext } from '../../src/constants/activityMessages';
import { ActivityAdBanner } from '../../src/components/activity/ActivityAdBanner';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../../src/styles/theme';
import { useThemeStore } from '../../src/stores/themeStore';

export default function Activity() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const mode = useThemeStore((s) => s.mode);

    const { todaySteps, todayDistance, todayCalories, isPedometerAvailable, isLoading } = usePedometer();
    const getYesterdaySteps = useActivityStore((s) => s.getYesterdaySteps);
    const dailyRecords = useActivityStore((s) => s.dailyRecords);

    const isDark = mode === 'dark';
    const gradientColors = isDark
        ? ['#1A2332', colors.background] as const
        : ['#D4F4FF', '#F0FAFF'] as const;

    const totalDistanceKm = useMemo(() => {
        const totalMeters = dailyRecords.reduce((sum, r) => sum + r.distance, 0) + todayDistance;
        return totalMeters / 1000;
    }, [dailyRecords, todayDistance]);

    const messageContext: MessageContext = useMemo(() => ({
        todaySteps,
        todayDistance,
        todayCalories,
        yesterdaySteps: getYesterdaySteps(),
        totalDistanceKm,
    }), [todaySteps, todayDistance, todayCalories, totalDistanceKm]);

    const activeMessages = useMemo(() => getActiveMessages(messageContext), [messageContext]);

    const distanceDisplay = useMemo(() => {
        if (todayDistance >= 1000) {
            return `${(todayDistance / 1000).toFixed(1)}km`;
        }
        return `${Math.round(todayDistance)}m`;
    }, [todayDistance]);

    if (isPedometerAvailable === false) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('activity.title')}</Text>
                </View>
                <View style={styles.unavailableContainer}>
                    <Ionicons name="footsteps-outline" size={64} color={colors.textWeak} />
                    <Text style={styles.unavailableText}>{t('activity.pedometerUnavailable')}</Text>
                </View>
            </View>
        );
    }

    return (
        <LinearGradient colors={gradientColors} style={styles.container}>
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('activity.title')}</Text>
                </View>

                <Pressable
                    style={styles.dashboardCard}
                    onPress={() => router.push('/activity-stats')}
                >
                    <View style={styles.stepCountContainer}>
                        <Ionicons name="footsteps" size={28} color={colors.primary} />
                        <Text style={styles.stepCount}>
                            {isLoading ? '—' : todaySteps.toLocaleString()}
                        </Text>
                        <Text style={styles.stepLabel}>{t('activity.steps')}</Text>
                    </View>

                    <Text style={styles.calorieSubtitle}>
                        {t('activity.caloriesBurned', { kcal: Math.round(todayCalories) })}
                    </Text>

                    <View style={styles.metricRow}>
                        <View style={styles.metricItem}>
                            <Ionicons name="navigate-outline" size={18} color={colors.primary} />
                            <Text style={styles.metricValue}>{distanceDisplay}</Text>
                            <Text style={styles.metricLabel}>{t('activity.distance')}</Text>
                        </View>
                        <View style={styles.metricDivider} />
                        <View style={styles.metricItem}>
                            <Ionicons name="flame-outline" size={18} color={colors.warning} />
                            <Text style={styles.metricValue}>{Math.round(todayCalories)}</Text>
                            <Text style={styles.metricLabel}>{t('activity.calories')}</Text>
                        </View>
                    </View>

                    <View style={styles.viewStatsRow}>
                        <Text style={styles.viewStatsText}>{t('activity.viewStats')}</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                    </View>
                </Pressable>

                <ActivityAdBanner colors={colors} />

                {activeMessages.length > 0 && (
                    <View style={styles.messagesContainer}>
                        {activeMessages.map((msg) => (
                            <View key={msg.id} style={styles.messageCard}>
                                <Text style={styles.messageIcon}>{msg.icon}</Text>
                                <Text style={styles.messageText}>
                                    {t(msg.i18nKey, msg.variables(messageContext))}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </LinearGradient>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.sm,
    },
    header: {
        paddingVertical: spacing.sm,
    },
    headerTitle: {
        ...typography.display,
        color: colors.textStrong,
    },
    dashboardCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        ...shadows.card,
    },
    stepCountContainer: {
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    stepCount: {
        fontSize: 48,
        fontWeight: '700',
        color: colors.textStrong,
        marginTop: spacing.xs,
    },
    stepLabel: {
        ...typography.caption,
        color: colors.textWeak,
        marginTop: 4,
    },
    calorieSubtitle: {
        ...typography.body,
        color: colors.primary,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    metricRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    metricItem: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    metricValue: {
        ...typography.heading,
        color: colors.textStrong,
    },
    metricLabel: {
        ...typography.caption,
        color: colors.textWeak,
    },
    metricDivider: {
        width: 1,
        height: 40,
        backgroundColor: colors.border,
    },
    viewStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.sm,
        gap: 4,
    },
    viewStatsText: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '600',
    },
    messagesContainer: {
        gap: spacing.xs,
    },
    messageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        gap: spacing.xs,
        ...shadows.button,
    },
    messageIcon: {
        fontSize: 24,
    },
    messageText: {
        ...typography.body,
        color: colors.textMedium,
        flex: 1,
    },
    unavailableContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    unavailableText: {
        ...typography.body,
        color: colors.textWeak,
        marginTop: spacing.sm,
        textAlign: 'center',
    },
});

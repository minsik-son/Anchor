/**
 * LocaAlert Activity Screen
 * Pedometer-based step dashboard with calorie tracking and motivational messages
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useColorScheme } from 'react-native';
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
import { useDistanceFormatter } from '../../src/utils/distanceFormatter';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function getWeekDates(): number[] {
    const today = new Date();
    const currentDay = today.getDay();
    const dates: number[] = [];

    for (let i = 0; i < 7; i++) {
        const diff = i - currentDay;
        const date = new Date(today);
        date.setDate(today.getDate() + diff);
        dates.push(date.getDate());
    }

    return dates;
}

export default function Activity() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const themeMode = useThemeStore((s) => s.mode);
    const systemScheme = useColorScheme();
    const isDarkMode = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { formatDistance } = useDistanceFormatter();

    const { todaySteps, todayDistance, todayCalories, isPedometerAvailable, isLoading } = usePedometer();
    const getYesterdaySteps = useActivityStore((s) => s.getYesterdaySteps);
    const dailyRecords = useActivityStore((s) => s.dailyRecords);

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

    const distanceDisplay = useMemo(() => formatDistance(todayDistance), [todayDistance, formatDistance]);

    const weekDates = useMemo(() => getWeekDates(), []);
    const todayDayIndex = new Date().getDay();

    if (isPedometerAvailable === false) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.unavailableContainer}>
                    <Ionicons name="pulse-outline" size={64} color={colors.textWeak} />
                    <Text style={styles.unavailableText}>{t('activity.pedometerUnavailable')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Background Gradient */}
            <LinearGradient
                colors={isDarkMode
                    ? ['#1E293B', '#1E293B']
                    : ['#F8FAFC', '#F1F5F9']
                }
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.backgroundGradient}
            />

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Weekly Calendar Strip */}
                <View style={styles.calendarStrip}>
                    {DAY_KEYS.map((dayKey, index) => {
                        const isToday = index === todayDayIndex;
                        return (
                            <View key={dayKey} style={styles.calendarDay}>
                                <Text style={[
                                    styles.calendarDayText,
                                    isToday && styles.calendarDayTextToday
                                ]}>
                                    {t(`days.${dayKey}`)}
                                </Text>
                                <View style={[
                                    styles.calendarDayCircle,
                                    isToday && styles.calendarDayCircleToday
                                ]}>
                                    <Text style={[
                                        styles.calendarDateText,
                                        isToday && styles.calendarDateTextToday
                                    ]}>
                                        {weekDates[index]}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                <Pressable
                    style={styles.dashboardCard}
                    onPress={() => router.push('/activity-stats')}
                >
                    {/* Header with View Stats Icon */}
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }} />
                        <View style={styles.viewStatsIcon}>
                            <Ionicons name="stats-chart" size={14} color={colors.textWeak} />
                        </View>
                    </View>

                    <View style={styles.stepCountContainer}>
                        <Ionicons name="pulse" size={28} color={colors.primary} />
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
                        <View style={styles.metricItem}>
                            <Ionicons name="flame-outline" size={18} color={colors.warning} />
                            <Text style={styles.metricValue}>{Math.round(todayCalories)}</Text>
                            <Text style={styles.metricLabel}>{t('activity.calories')}</Text>
                        </View>
                    </View>
                </Pressable>

                <ActivityAdBanner colors={colors} />

                {activeMessages.length > 0 && (
                    <View style={styles.messagesContainer}>
                        {activeMessages.map((msg) => {
                            let variables = msg.variables(messageContext);
                            // Format height for landmark_burj message with unit
                            if (msg.id === 'landmark_burj') {
                                variables = { ...variables, height: formatDistance(828) };
                            }
                            return (
                                <View key={msg.id} style={styles.messageCard}>
                                    <Text style={styles.messageIcon}>{msg.icon}</Text>
                                    <View style={styles.messageContent}>
                                        <Text style={styles.messageTitle}>{t(msg.i18nKey, variables)}</Text>
                                        <Text style={styles.messageSub}>{t(msg.i18nSubKey)}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
    },
    backgroundGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
    },
    calendarStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        marginBottom: spacing.sm,
    },
    calendarDay: {
        alignItems: 'center',
        gap: 4,
    },
    calendarDayText: {
        ...typography.caption,
        color: colors.textWeak,
        fontSize: 11,
    },
    calendarDayTextToday: {
        color: '#9594E8',
        fontWeight: '600',
    },
    calendarDayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarDayCircleToday: {
        backgroundColor: '#9594E8',
    },
    calendarDateText: {
        ...typography.body,
        color: colors.textMedium,
        fontWeight: '600',
    },
    calendarDateTextToday: {
        color: '#FFFFFF',
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
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: spacing.xs,
    },
    viewStatsIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
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
        gap: spacing.sm,
        ...shadows.card,
    },
    messageIcon: {
        fontSize: 28,
    },
    messageContent: {
        flex: 1,
    },
    messageTitle: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '700',
    },
    messageSub: {
        ...typography.caption,
        color: colors.textWeak,
        marginTop: 2,
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

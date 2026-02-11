/**
 * LocaAlert Activity Stats Screen
 * Weekly/monthly comparison charts with bar graphs
 */

import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import { useActivityStore, DailyStepRecord } from '../src/stores/activityStore';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';

type Period = 'weekly' | 'monthly';

export default function ActivityStats() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [period, setPeriod] = useState<Period>('weekly');
    const { getWeeklyData, getMonthlyData, loadHistoricalData, dailyRecords } = useActivityStore();

    useEffect(() => {
        loadHistoricalData(60);
    }, []);

    const currentData = useMemo(() => {
        return period === 'weekly' ? getWeeklyData(0) : getMonthlyData(0);
    }, [period, dailyRecords]);

    const previousData = useMemo(() => {
        return period === 'weekly' ? getWeeklyData(1) : getMonthlyData(1);
    }, [period, dailyRecords]);

    const summaryStats = useMemo(() => {
        const totalSteps = currentData.reduce((sum, r) => sum + r.steps, 0);
        const activeDays = currentData.filter((r) => r.steps > 0).length;
        const dailyAvg = activeDays > 0 ? Math.round(totalSteps / activeDays) : 0;
        const bestDay = currentData.reduce((best, r) => r.steps > best.steps ? r : best, currentData[0]);
        return { totalSteps, dailyAvg, bestDay };
    }, [currentData]);

    const comparisonPercent = useMemo(() => {
        const currentTotal = currentData.reduce((sum, r) => sum + r.steps, 0);
        const previousTotal = previousData.reduce((sum, r) => sum + r.steps, 0);
        if (previousTotal === 0) return null;
        return Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
    }, [currentData, previousData]);

    const chartData = useMemo(() => {
        return buildChartData(currentData, previousData, period, colors, t);
    }, [currentData, previousData, period, colors]);

    const hasData = currentData.some((r) => r.steps > 0) || previousData.some((r) => r.steps > 0);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('activity.stats.title')}</Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.toggleContainer}>
                    <Pressable
                        style={[styles.toggleButton, period === 'weekly' && styles.toggleActive]}
                        onPress={() => setPeriod('weekly')}
                    >
                        <Text style={[styles.toggleText, period === 'weekly' && styles.toggleTextActive]}>
                            {t('activity.stats.weekly')}
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.toggleButton, period === 'monthly' && styles.toggleActive]}
                        onPress={() => setPeriod('monthly')}
                    >
                        <Text style={[styles.toggleText, period === 'monthly' && styles.toggleTextActive]}>
                            {t('activity.stats.monthly')}
                        </Text>
                    </Pressable>
                </View>

                {!hasData ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="bar-chart-outline" size={64} color={colors.textWeak} />
                        <Text style={styles.emptyText}>{t('activity.noDataYet')}</Text>
                        <Text style={styles.emptySubtext}>{t('activity.noDataHint')}</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.summaryCard}>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>{t('activity.stats.totalSteps')}</Text>
                                <Text style={styles.summaryValue}>{summaryStats.totalSteps.toLocaleString()}</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>{t('activity.stats.dailyAvg')}</Text>
                                <Text style={styles.summaryValue}>{summaryStats.dailyAvg.toLocaleString()}</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>{t('activity.stats.bestDay')}</Text>
                                <Text style={styles.summaryValue}>{summaryStats.bestDay.steps.toLocaleString()}</Text>
                            </View>
                        </View>

                        <View style={styles.chartCard}>
                            <View style={styles.legendRow}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                                    <Text style={styles.legendText}>{t('activity.stats.current')}</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
                                    <Text style={styles.legendText}>{t('activity.stats.previous')}</Text>
                                </View>
                            </View>
                            <ScrollView horizontal={period === 'monthly'} showsHorizontalScrollIndicator={false}>
                                <BarChart
                                    data={chartData}
                                    barWidth={period === 'weekly' ? 16 : 8}
                                    spacing={period === 'weekly' ? 24 : 6}
                                    noOfSections={4}
                                    yAxisThickness={0}
                                    xAxisThickness={1}
                                    xAxisColor={colors.border}
                                    yAxisTextStyle={{ color: colors.textWeak, fontSize: 10 }}
                                    xAxisLabelTextStyle={{ color: colors.textWeak, fontSize: 10 }}
                                    hideRules
                                    isAnimated
                                    barBorderRadius={4}
                                    height={200}
                                />
                            </ScrollView>
                        </View>

                        {comparisonPercent !== null && (
                            <View style={styles.comparisonCard}>
                                <Ionicons
                                    name={comparisonPercent >= 0 ? 'trending-up' : 'trending-down'}
                                    size={24}
                                    color={comparisonPercent >= 0 ? colors.success : colors.error}
                                />
                                <Text style={styles.comparisonText}>
                                    {comparisonPercent === 0
                                        ? t('activity.stats.noChange')
                                        : t('activity.stats.comparison', {
                                            percent: Math.abs(comparisonPercent),
                                            direction: comparisonPercent > 0
                                                ? t('activity.stats.more')
                                                : t('activity.stats.less'),
                                        })
                                    }
                                </Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </View>
    );
}

function buildChartData(
    current: DailyStepRecord[],
    previous: DailyStepRecord[],
    period: Period,
    colors: ThemeColors,
    t: (key: string) => string,
) {
    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    if (period === 'weekly') {
        const items: Array<{
            value: number;
            frontColor: string;
            label?: string;
            spacing?: number;
        }> = [];

        for (let i = 0; i < 7; i++) {
            items.push({
                value: previous[i]?.steps ?? 0,
                frontColor: colors.border,
                label: dayLabels[i],
                spacing: 2,
            });
            items.push({
                value: current[i]?.steps ?? 0,
                frontColor: colors.primary,
            });
        }
        return items;
    }

    // Monthly: only current period bars
    return current.map((record, i) => ({
        value: record.steps,
        frontColor: colors.primary,
        label: (i + 1) % 5 === 0 ? String(i + 1) : '',
    }));
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        ...typography.heading,
        color: colors.textStrong,
    },
    scrollContent: {
        paddingHorizontal: spacing.sm,
        gap: spacing.sm,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius.sm,
        padding: 4,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: spacing.xs,
        alignItems: 'center',
        borderRadius: radius.sm,
    },
    toggleActive: {
        backgroundColor: colors.primary,
    },
    toggleText: {
        ...typography.body,
        color: colors.textMedium,
        fontWeight: '600',
    },
    toggleTextActive: {
        color: '#FFFFFF',
    },
    summaryCard: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        ...shadows.card,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    summaryLabel: {
        ...typography.caption,
        color: colors.textWeak,
    },
    summaryValue: {
        ...typography.heading,
        color: colors.textStrong,
        fontSize: 18,
    },
    summaryDivider: {
        width: 1,
        backgroundColor: colors.border,
    },
    chartCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        ...shadows.card,
    },
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        ...typography.caption,
        color: colors.textWeak,
    },
    comparisonCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        gap: spacing.xs,
        ...shadows.button,
    },
    comparisonText: {
        ...typography.body,
        color: colors.textMedium,
        flex: 1,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.lg,
    },
    emptyText: {
        ...typography.heading,
        color: colors.textMedium,
        marginTop: spacing.sm,
    },
    emptySubtext: {
        ...typography.body,
        color: colors.textWeak,
        marginTop: spacing.xs,
        textAlign: 'center',
    },
});

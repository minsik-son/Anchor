/**
 * LocaAlert Activity Stats Screen
 * Redesigned with improved bar chart (top labels, no Y-axis clutter)
 * and step calendar grid (GitHub-style contribution heatmap)
 */

import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useActivityStore, DailyStepRecord } from '../src/stores/activityStore';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';

type Period = 'weekly' | 'monthly';

// ---------------------------------------------------------------------------
// Step Calendar Component (Monthly calendar with step counts per day)
// ---------------------------------------------------------------------------

interface StepCalendarProps {
    dailyRecords: DailyStepRecord[];
    colors: ThemeColors;
}

function StepCalendar({ dailyRecords, colors }: StepCalendarProps) {
    const { width } = useWindowDimensions();
    const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = last month, etc.

    const calendarWidth = width - spacing.sm * 4;
    const cellWidth = Math.floor(calendarWidth / 7);

    // Build record map for quick lookup
    const recordMap = useMemo(() => {
        const map = new Map<string, number>();
        dailyRecords.forEach(r => map.set(r.date, r.steps));
        return map;
    }, [dailyRecords]);

    // Current display month
    const displayDate = useMemo(() => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() + monthOffset);
        return d;
    }, [monthOffset]);

    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();

    // Calendar grid: array of weeks, each week is 7 cells (null for empty)
    const calendarGrid = useMemo(() => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Start on Sunday (0) - adjust first day offset
        let startOffset = firstDay.getDay(); // 0=Sun, 1=Mon, ...

        const weeks: ({ day: number; steps: number; isToday: boolean; isFuture: boolean } | null)[][] = [];
        let currentWeek: ({ day: number; steps: number; isToday: boolean; isFuture: boolean } | null)[] = [];

        // Fill leading empty cells
        for (let i = 0; i < startOffset; i++) {
            currentWeek.push(null);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const cellDate = new Date(year, month, day);
            const isToday = cellDate.getFullYear() === today.getFullYear()
                && cellDate.getMonth() === today.getMonth()
                && cellDate.getDate() === today.getDate();
            const isFuture = cellDate > today;

            currentWeek.push({
                day,
                steps: isFuture ? -1 : (recordMap.get(dateStr) ?? 0),
                isToday,
                isFuture,
            });

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }

        // Fill trailing empty cells
        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push(null);
            }
            weeks.push(currentWeek);
        }

        return weeks;
    }, [year, month, recordMap]);

    // Month stats
    const monthStats = useMemo(() => {
        let activeDays = 0;
        let totalSteps = 0;
        calendarGrid.forEach(week =>
            week.forEach(cell => {
                if (cell && cell.steps > 0) {
                    activeDays++;
                    totalSteps += cell.steps;
                }
            }),
        );
        return { activeDays, totalSteps };
    }, [calendarGrid]);

    const formatStepCount = (steps: number): string => {
        if (steps <= 0) return '';
        if (steps >= 10000) return `${(steps / 1000).toFixed(0)}k`;
        if (steps >= 1000) return `${(steps / 1000).toFixed(1)}k`;
        return `${steps}`;
    };

    const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];
    const monthLabel = `${year}년 ${month + 1}월`;

    const canGoForward = monthOffset < 0;

    return (
        <View style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            padding: spacing.sm,
            ...shadows.card,
        }}>
            {/* Month navigation header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Pressable onPress={() => setMonthOffset(prev => prev - 1)} hitSlop={8}>
                    <Ionicons name="chevron-back" size={20} color={colors.textMedium} />
                </Pressable>
                <Text style={{ ...typography.body, fontWeight: '700', color: colors.textStrong, fontSize: 16 }}>
                    {monthLabel}
                </Text>
                <Pressable
                    onPress={() => canGoForward && setMonthOffset(prev => prev + 1)}
                    hitSlop={8}
                    style={{ opacity: canGoForward ? 1 : 0.3 }}
                >
                    <Ionicons name="chevron-forward" size={20} color={colors.textMedium} />
                </Pressable>
            </View>

            {/* Day of week headers */}
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                {dayHeaders.map((label, i) => (
                    <View key={i} style={{ width: cellWidth, alignItems: 'center' }}>
                        <Text style={{
                            fontSize: 12,
                            fontWeight: '600',
                            color: i === 0 ? colors.error : i === 6 ? colors.primary : colors.textWeak,
                        }}>
                            {label}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Calendar grid */}
            {calendarGrid.map((week, weekIdx) => (
                <View key={weekIdx} style={{ flexDirection: 'row', marginBottom: 2 }}>
                    {week.map((cell, dayIdx) => (
                        <View key={dayIdx} style={{
                            width: cellWidth,
                            alignItems: 'center',
                            paddingVertical: 6,
                        }}>
                            {cell ? (
                                <>
                                    {/* Date number */}
                                    <View style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 14,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        backgroundColor: cell.isToday ? colors.primary : 'transparent',
                                    }}>
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: cell.isToday ? '700' : '500',
                                            color: cell.isToday
                                                ? '#FFFFFF'
                                                : cell.isFuture
                                                    ? colors.textWeak + '60'
                                                    : dayIdx === 0
                                                        ? colors.error
                                                        : dayIdx === 6
                                                            ? colors.primary
                                                            : colors.textStrong,
                                        }}>
                                            {cell.day}
                                        </Text>
                                    </View>
                                    {/* Step count below date */}
                                    <Text style={{
                                        fontSize: 9,
                                        fontWeight: '500',
                                        color: cell.steps > 0 ? colors.primary : 'transparent',
                                        marginTop: 2,
                                    }}>
                                        {cell.steps > 0 ? formatStepCount(cell.steps) : '-'}
                                    </Text>
                                </>
                            ) : (
                                <View style={{ height: 28 + 2 + 12 }} />
                            )}
                        </View>
                    ))}
                </View>
            ))}

            {/* Month summary */}
            <View style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                gap: 16,
            }}>
                <Text style={{ ...typography.caption, color: colors.textWeak }}>
                    {monthStats.activeDays}일 활동
                </Text>
                <View style={{ width: 1, height: 12, backgroundColor: colors.border }} />
                <Text style={{ ...typography.caption, color: colors.textWeak }}>
                    {monthStats.totalSteps.toLocaleString()}걸음
                </Text>
            </View>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Custom Bar Chart Component (cleaner than gifted-charts)
// ---------------------------------------------------------------------------

interface BarChartCustomProps {
    currentData: DailyStepRecord[];
    previousData: DailyStepRecord[];
    period: Period;
    colors: ThemeColors;
}

function CustomBarChart({ currentData, previousData, period, colors }: BarChartCustomProps) {
    const { t } = useTranslation();

    const maxValue = useMemo(() => {
        const allValues = [
            ...currentData.map(r => r.steps),
            ...previousData.map(r => r.steps),
        ];
        return Math.max(...allValues, 100);
    }, [currentData, previousData]);

    const chartHeight = 180;
    const dayLabels = [
        t('days.mon'), t('days.tue'), t('days.wed'), t('days.thu'),
        t('days.fri'), t('days.sat'), t('days.sun'),
    ];

    if (period === 'weekly') {
        return (
            <View>
                {/* Bars */}
                <View style={{ height: chartHeight, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    {currentData.map((record, i) => {
                        const prevSteps = previousData[i]?.steps ?? 0;
                        const currHeight = maxValue > 0 ? (record.steps / maxValue) * chartHeight : 0;
                        const prevHeight = maxValue > 0 ? (prevSteps / maxValue) * chartHeight : 0;
                        const showLabel = record.steps > 0;

                        return (
                            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                                {/* Step count label on top of bar */}
                                {showLabel && (
                                    <Text style={{
                                        fontSize: 9,
                                        fontWeight: '600',
                                        color: colors.primary,
                                        marginBottom: 4,
                                    }}>
                                        {record.steps >= 1000
                                            ? `${(record.steps / 1000).toFixed(1)}k`
                                            : record.steps}
                                    </Text>
                                )}
                                {/* Bar pair */}
                                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                                    {/* Previous period bar */}
                                    <View style={{
                                        width: 12,
                                        height: Math.max(prevHeight, prevSteps > 0 ? 4 : 0),
                                        backgroundColor: colors.border,
                                        borderRadius: 3,
                                    }} />
                                    {/* Current period bar */}
                                    <View style={{
                                        width: 12,
                                        height: Math.max(currHeight, record.steps > 0 ? 4 : 0),
                                        backgroundColor: colors.primary,
                                        borderRadius: 3,
                                    }} />
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* X-axis labels */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    {dayLabels.map((label, i) => (
                        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={{ fontSize: 11, color: colors.textWeak, fontWeight: '500' }}>
                                {label}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    // Monthly view
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
                <View style={{ height: chartHeight, flexDirection: 'row', alignItems: 'flex-end' }}>
                    {currentData.map((record, i) => {
                        const barHeight = maxValue > 0 ? (record.steps / maxValue) * chartHeight : 0;
                        return (
                            <View key={i} style={{ alignItems: 'center', marginRight: 3 }}>
                                <View style={{
                                    width: 8,
                                    height: Math.max(barHeight, record.steps > 0 ? 3 : 0),
                                    backgroundColor: record.steps > 0 ? colors.primary : colors.border,
                                    borderRadius: 2,
                                }} />
                            </View>
                        );
                    })}
                </View>
                <View style={{ flexDirection: 'row', marginTop: 6 }}>
                    {currentData.map((_, i) => (
                        <View key={i} style={{ width: 8, marginRight: 3, alignItems: 'center' }}>
                            {(i + 1) % 5 === 0 && (
                                <Text style={{ fontSize: 9, color: colors.textWeak }}>{i + 1}</Text>
                            )}
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function ActivityStats() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [period, setPeriod] = useState<Period>('weekly');
    const { getWeeklyData, getMonthlyData, loadHistoricalData, dailyRecords, isLoading } = useActivityStore();

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

                {isLoading && dailyRecords.length === 0 ? (
                    <View style={styles.emptyState}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : !hasData ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="bar-chart-outline" size={64} color={colors.textWeak} />
                        <Text style={styles.emptyText}>{t('activity.noDataYet')}</Text>
                        <Text style={styles.emptySubtext}>{t('activity.noDataHint')}</Text>
                    </View>
                ) : (
                    <>
                        {/* Summary Card */}
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

                        {/* Chart Card (improved) */}
                        <View style={styles.chartCard}>
                            <View style={styles.legendRow}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                                    <Text style={styles.legendText}>{t('activity.stats.current')}</Text>
                                </View>
                                {period === 'weekly' && (
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
                                        <Text style={styles.legendText}>{t('activity.stats.previous')}</Text>
                                    </View>
                                )}
                            </View>
                            <CustomBarChart
                                currentData={currentData}
                                previousData={previousData}
                                period={period}
                                colors={colors}
                            />
                        </View>

                        {/* Comparison Card */}
                        {comparisonPercent !== null && (
                            <View style={styles.comparisonCard}>
                                <View style={[
                                    styles.comparisonIconContainer,
                                    { backgroundColor: comparisonPercent >= 0 ? colors.success + '18' : colors.error + '18' },
                                ]}>
                                    <Ionicons
                                        name={comparisonPercent >= 0 ? 'trending-up' : 'trending-down'}
                                        size={20}
                                        color={comparisonPercent >= 0 ? colors.success : colors.error}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.comparisonTitle}>
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
                                    <Text style={styles.comparisonSubtitle}>
                                        {period === 'weekly' ? '지난주 대비' : '지난달 대비'}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Step Calendar (GitHub heatmap style) */}
                        <StepCalendar dailyRecords={dailyRecords} colors={colors} />
                    </>
                )}
            </ScrollView>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
        marginBottom: 12,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
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
        gap: 12,
        ...shadows.card,
    },
    comparisonIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    comparisonTitle: {
        ...typography.body,
        fontWeight: '600',
        color: colors.textStrong,
    },
    comparisonSubtitle: {
        ...typography.caption,
        color: colors.textWeak,
        marginTop: 2,
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

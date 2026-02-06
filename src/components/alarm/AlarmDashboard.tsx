/**
 * AlarmDashboard Component
 * Active alarm bottom sheet showing distance, elapsed time, and checklist
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Alarm, ActionMemo } from '../../db/schema';
import { formatDistanceOrFallback } from '../../utils/format';
import { typography, spacing, radius, useThemeColors, ThemeColors } from '../../styles/theme';

interface AlarmDashboardProps {
    alarm: Alarm;
    memos: ActionMemo[];
    distanceToTarget: number | null;
    elapsedTime: string;
    onCancel: () => void;
}

export default function AlarmDashboard({
    alarm,
    memos,
    distanceToTarget,
    elapsedTime,
    onCancel,
}: AlarmDashboardProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <>
            {/* Alarm Title Row */}
            <View style={styles.dashboardHeader}>
                <View style={styles.dashboardTitleRow}>
                    <Ionicons name="navigate" size={20} color={colors.primary} />
                    <Text style={styles.dashboardTitle}>{alarm.title}</Text>
                </View>
            </View>

            {/* Prominent Distance Display */}
            <View style={styles.distanceDisplayContainer}>
                <Text style={styles.distanceValue}>
                    {formatDistanceOrFallback(distanceToTarget)}
                </Text>
                <Text style={styles.distanceLabel}>
                    {distanceToTarget !== null
                        ? t('alarmDashboard.distanceLabel')
                        : t('home.activeAlarm.calculating')}
                </Text>
            </View>

            {/* Elapsed Time */}
            <View style={styles.elapsedTimeContainer}>
                <Ionicons name="time-outline" size={16} color={colors.textMedium} />
                <Text style={styles.elapsedTimeText}>{elapsedTime}</Text>
                <Text style={styles.elapsedTimeLabel}>{t('alarmDashboard.elapsedTime')}</Text>
            </View>

            {/* Checklist Preview */}
            {memos.length > 0 && (
                <View style={styles.dashboardChecklist}>
                    <Text style={styles.dashboardChecklistTitle}>
                        {t('alarmDashboard.checklist')}
                    </Text>
                    {memos.map((memo) => (
                        <View key={memo.id} style={styles.dashboardCheckItem}>
                            <Ionicons
                                name={memo.is_checked ? 'checkbox' : 'square-outline'}
                                size={18}
                                color={memo.is_checked ? colors.primary : colors.textWeak}
                            />
                            <Text style={[
                                styles.dashboardCheckText,
                                memo.is_checked && styles.dashboardCheckTextDone,
                            ]}>
                                {memo.content}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Cancel Alarm Button */}
            <Pressable
                style={({ pressed }) => [
                    styles.cancelAlarmButton,
                    pressed && styles.cancelAlarmButtonPressed,
                ]}
                onPress={onCancel}
            >
                <Text style={styles.cancelAlarmText}>{t('alarmDashboard.cancelAlarm')}</Text>
            </Pressable>
        </>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    dashboardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    dashboardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        flex: 1,
    },
    dashboardTitle: {
        ...typography.heading,
        color: colors.textStrong,
    },
    distanceDisplayContainer: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
        marginBottom: spacing.xs,
    },
    distanceValue: {
        fontSize: 40,
        fontWeight: '800',
        color: colors.primary,
        lineHeight: 48,
    },
    distanceLabel: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 4,
    },
    elapsedTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    elapsedTimeText: {
        ...typography.body,
        color: colors.textMedium,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    elapsedTimeLabel: {
        ...typography.caption,
        color: colors.textWeak,
    },
    dashboardChecklist: {
        backgroundColor: colors.background,
        borderRadius: radius.md,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    dashboardChecklistTitle: {
        ...typography.caption,
        color: colors.textMedium,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    dashboardCheckItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: 4,
    },
    dashboardCheckText: {
        ...typography.body,
        color: colors.textStrong,
    },
    dashboardCheckTextDone: {
        color: colors.textWeak,
        textDecorationLine: 'line-through',
    },
    cancelAlarmButton: {
        borderWidth: 2,
        borderColor: colors.error,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    cancelAlarmButtonPressed: {
        opacity: 0.7,
        backgroundColor: `${colors.error}10`,
    },
    cancelAlarmText: {
        ...typography.body,
        color: colors.error,
        fontWeight: '700',
    },
});

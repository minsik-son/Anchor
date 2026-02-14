/**
 * Challenge Detail Screen
 * Shows challenge info, progress, visit records, and delete action
 */

import { useEffect, useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, FlatList, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';
import { ChallengeRow, VisitRecordRow } from '../src/db/schema';
import { useChallengeStore } from '../src/stores/challengeStore';
import * as db from '../src/db/database';
import { IconBox } from '../src/components/challenge/IconBox';
import { ProgressBar } from '../src/components/challenge/ProgressBar';
import { ComboBadge } from '../src/components/challenge/ComboBadge';

export default function ChallengeDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { deleteChallenge } = useChallengeStore();
    const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
    const [visitRecords, setVisitRecords] = useState<VisitRecordRow[]>([]);

    useEffect(() => {
        if (!id) return;
        loadData();
    }, [id]);

    const loadData = async () => {
        if (!id) return;
        const [c, records] = await Promise.all([
            db.getChallengeById(id),
            db.getVisitRecordsByChallengeId(id),
        ]);
        setChallenge(c);
        setVisitRecords(records);
    };

    const handleDelete = useCallback(() => {
        if (!id) return;
        Alert.alert(
            t('challenge.detail.deleteTitle'),
            t('challenge.detail.deleteMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        await deleteChallenge(id);
                        router.back();
                    },
                },
            ]
        );
    }, [id, deleteChallenge, t]);

    if (!challenge) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} hitSlop={8}>
                        <Ionicons name="chevron-back" size={24} color={colors.textStrong} />
                    </Pressable>
                    <Text style={styles.headerTitle}>{t('challenge.detail.title')}</Text>
                    <View style={{ width: 24 }} />
                </View>
            </View>
        );
    }

    const displayName = challenge.name || challenge.place_name;
    const statusBadgeColor = challenge.status === 'active' ? colors.primary
        : challenge.status === 'graduated' ? colors.success
        : colors.error;

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    const dayOfWeekLabel = (dow: string) => {
        const map: Record<string, string> = {
            SUN: t('days.sun'), MON: t('days.mon'), TUE: t('days.tue'),
            WED: t('days.wed'), THU: t('days.thu'), FRI: t('days.fri'), SAT: t('days.sat'),
        };
        return map[dow] || dow;
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('challenge.detail.title')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Challenge Info Card */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <IconBox icon={challenge.icon} size={56} />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoName}>{displayName}</Text>
                            <Text style={styles.infoPlace}>{challenge.place_name}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusBadgeColor + '15' }]}>
                            <Text style={[styles.statusText, { color: statusBadgeColor }]}>
                                {t(`challenge.status.${challenge.status}`)}
                            </Text>
                        </View>
                    </View>

                    {/* Progress */}
                    {challenge.status === 'active' && (
                        <View style={styles.progressSection}>
                            <View style={styles.progressRow}>
                                <Text style={styles.progressLabel}>
                                    {t('challenge.detail.week', {
                                        current: challenge.current_week,
                                        total: challenge.duration_weeks,
                                    })}
                                </Text>
                                <ComboBadge combo={challenge.combo} />
                            </View>
                            <ProgressBar current={challenge.weekly_visits} goal={challenge.weekly_goal} />
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Ionicons name="flame" size={16} color={colors.warning} />
                                    <Text style={styles.statText}>
                                        {t('challenge.combo', { count: challenge.combo })}
                                    </Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Ionicons name="shield-checkmark" size={16} color={colors.success} />
                                    <Text style={styles.statText}>
                                        {t('challenge.chances', { count: challenge.chances })}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* Visit Records */}
                <View style={styles.recordsSection}>
                    <Text style={styles.recordsTitle}>
                        {t('challenge.detail.visitRecords', { count: visitRecords.length })}
                    </Text>
                    {visitRecords.length === 0 ? (
                        <Text style={styles.emptyText}>{t('challenge.detail.noVisits')}</Text>
                    ) : (
                        visitRecords.map((record) => (
                            <View key={record.id} style={styles.recordItem}>
                                <View style={styles.recordLeft}>
                                    <Ionicons
                                        name={record.counted ? 'checkmark-circle' : 'close-circle'}
                                        size={20}
                                        color={record.counted ? colors.success : colors.textWeak}
                                    />
                                    <View>
                                        <Text style={styles.recordDate}>
                                            {formatDate(record.entered_at)}
                                        </Text>
                                        <Text style={styles.recordDay}>
                                            {dayOfWeekLabel(record.day_of_week)}
                                            {record.dwell_minutes !== null &&
                                                ` · ${Math.round(record.dwell_minutes)}${t('challenge.detail.min')}`}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[
                                    styles.recordStatus,
                                    { color: record.counted ? colors.success : colors.textWeak },
                                ]}>
                                    {record.counted
                                        ? t('challenge.detail.counted')
                                        : t('challenge.detail.notCounted')}
                                </Text>
                            </View>
                        ))
                    )}
                </View>

                {/* Delete Button */}
                <Pressable style={styles.deleteButton} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                    <Text style={styles.deleteButtonText}>{t('challenge.detail.delete')}</Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        ...typography.heading,
        color: colors.textStrong,
    },
    // Info Card
    infoCard: {
        margin: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        ...shadows.card,
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoContent: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    infoName: {
        ...typography.heading,
        color: colors.textStrong,
    },
    infoPlace: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 4,
        borderRadius: radius.sm,
    },
    statusText: {
        ...typography.caption,
        fontWeight: '700',
        fontSize: 11,
    },
    // Progress
    progressSection: {
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    progressLabel: {
        ...typography.body,
        fontWeight: '600',
        color: colors.textStrong,
    },
    statsRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.sm,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        ...typography.caption,
        color: colors.textMedium,
    },
    // Records
    recordsSection: {
        marginHorizontal: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        ...shadows.card,
    },
    recordsTitle: {
        ...typography.body,
        fontWeight: '700',
        color: colors.textStrong,
        marginBottom: spacing.sm,
    },
    emptyText: {
        ...typography.body,
        color: colors.textWeak,
        textAlign: 'center',
        paddingVertical: spacing.md,
    },
    recordItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    recordLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    recordDate: {
        ...typography.body,
        color: colors.textStrong,
    },
    recordDay: {
        ...typography.caption,
        color: colors.textMedium,
    },
    recordStatus: {
        ...typography.caption,
        fontWeight: '600',
    },
    // Delete
    deleteButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.xs,
        margin: spacing.md,
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.error + '10',
    },
    deleteButtonText: {
        ...typography.body,
        color: colors.error,
        fontWeight: '600',
    },
});

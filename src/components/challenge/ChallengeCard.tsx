/**
 * ChallengeCard - Active challenge card with progress, combo, and D-day
 * Card border and badge change based on combo tier
 */

import { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../../styles/theme';
import { ChallengeRow } from '../../db/schema';
import { IconBox } from './IconBox';
import { ProgressBar } from './ProgressBar';
import { ComboBadge, getComboTier, TIER_STYLES } from './ComboBadge';

interface ChallengeCardProps {
    challenge: ChallengeRow;
    onPress: () => void;
}

export function ChallengeCard({ challenge, onPress }: ChallengeCardProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const tier = getComboTier(challenge.combo);
    const tierStyle = TIER_STYLES[tier];

    const displayName = challenge.name || challenge.place_name;
    const remaining = Math.max(challenge.weekly_goal - challenge.weekly_visits, 0);

    const daysLeftInWeek = useMemo(() => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        return daysUntilSunday;
    }, []);

    const totalWeeksLeft = challenge.duration_weeks - challenge.current_week;

    const motivationalText = useMemo(() => {
        if (challenge.weekly_visits >= challenge.weekly_goal) {
            return t('challenge.weekComplete');
        }
        if (remaining === 1) {
            return t('challenge.oneMore');
        }
        return t('challenge.remainingVisits', { count: remaining });
    }, [remaining, challenge.weekly_visits, challenge.weekly_goal, t]);

    const cardBorderColor = tier !== 'default' ? tierStyle.borderColor : 'transparent';

    return (
        <TouchableOpacity
            style={[styles.card, { borderColor: cardBorderColor }]}
            activeOpacity={0.7}
            onPress={onPress}
        >
            <View style={styles.header}>
                <IconBox icon={challenge.icon} size={48} />
                <View style={styles.headerInfo}>
                    <Text style={styles.title} numberOfLines={1}>{displayName}</Text>
                    <Text style={styles.motivational}>{motivationalText}</Text>
                </View>
                <View style={styles.headerRight}>
                    <ComboBadge combo={challenge.combo} />
                    <View style={styles.dDayBadge}>
                        <Text style={styles.dDayText}>
                            {t('challenge.weekInfo', {
                                current: challenge.current_week,
                                total: challenge.duration_weeks,
                            })}
                        </Text>
                    </View>
                </View>
            </View>

            <ProgressBar current={challenge.weekly_visits} goal={challenge.weekly_goal} />

            {challenge.chances > 0 && (
                <View style={styles.chanceRow}>
                    <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                    <Text style={styles.chanceText}>
                        {t('challenge.chances', { count: challenge.chances })}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 2,
        ...shadows.card,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    headerInfo: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    headerRight: {
        alignItems: 'flex-end',
        gap: 4,
    },
    title: {
        ...typography.body,
        fontWeight: '700',
        color: colors.textStrong,
    },
    motivational: {
        ...typography.caption,
        color: colors.primary,
        marginTop: 2,
    },
    dDayBadge: {
        backgroundColor: colors.primary + '15',
        paddingHorizontal: spacing.xs,
        paddingVertical: 3,
        borderRadius: radius.sm,
    },
    dDayText: {
        ...typography.caption,
        fontWeight: '600',
        color: colors.primary,
        fontSize: 11,
    },
    chanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: spacing.xs,
    },
    chanceText: {
        ...typography.caption,
        color: colors.success,
        fontSize: 11,
    },
});

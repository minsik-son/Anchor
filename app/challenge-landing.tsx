/**
 * LocaAlert Challenge Landing Screen
 * Browse active and recommended challenges
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';

interface ActiveChallenge {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBgColor: string;
    progress: number;
    goal: number;
    daysLeft: number;
}

interface RecommendedChallenge {
    id: string;
    translationKey: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBgColor: string;
}

const ACTIVE_CHALLENGE: ActiveChallenge = {
    id: 'active-1',
    icon: 'barbell',
    iconColor: '#3182F6',
    iconBgColor: '#E8F3FF',
    progress: 3,
    goal: 5,
    daysLeft: 2,
};

const RECOMMENDED_CHALLENGES: RecommendedChallenge[] = [
    {
        id: '1',
        translationKey: 'walk',
        icon: 'walk',
        iconColor: '#00C853',
        iconBgColor: '#E6F9EE',
    },
    {
        id: '2',
        translationKey: 'study',
        icon: 'book',
        iconColor: '#FF9800',
        iconBgColor: '#FFF3E0',
    },
    {
        id: '3',
        translationKey: 'gym',
        icon: 'barbell',
        iconColor: '#3182F6',
        iconBgColor: '#E8F3FF',
    },
];

function ProgressBar({ progress, goal, colors, t }: { progress: number; goal: number; colors: ThemeColors; t: (key: string, options?: object) => string }) {
    const percentage = (progress / goal) * 100;
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
            </View>
            <Text style={styles.progressText}>
                {t('challenge.activeChallenge.progress', { progress, goal })}
            </Text>
        </View>
    );
}

export default function ChallengeLanding() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('challenge.headerTitle')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
                showsVerticalScrollIndicator={false}
            >
                {/* Active Challenge Card */}
                <TouchableOpacity style={styles.activeChallengeCard} activeOpacity={0.7}>
                    <View style={styles.activeChallengeHeader}>
                        <View style={[styles.iconBox, { backgroundColor: ACTIVE_CHALLENGE.iconBgColor }]}>
                            <Ionicons
                                name={ACTIVE_CHALLENGE.icon}
                                size={24}
                                color={ACTIVE_CHALLENGE.iconColor}
                            />
                        </View>
                        <View style={styles.activeChallengeInfo}>
                            <Text style={styles.activeChallengeTitle}>
                                {t('challenge.activeChallenge.title')}
                            </Text>
                        </View>
                        <View style={styles.dDayBadge}>
                            <Text style={styles.dDayText}>
                                {t('challenge.activeChallenge.daysLeft', { days: ACTIVE_CHALLENGE.daysLeft })}
                            </Text>
                        </View>
                    </View>
                    <ProgressBar
                        progress={ACTIVE_CHALLENGE.progress}
                        goal={ACTIVE_CHALLENGE.goal}
                        colors={colors}
                        t={t}
                    />
                </TouchableOpacity>

                {/* Recommended Challenges Section */}
                <View style={styles.recommendedCard}>
                    {/* Card Header */}
                    <View style={styles.recommendedHeader}>
                        <Text style={styles.recommendedTitle}>{t('challenge.recommended.title')}</Text>
                        <Text style={styles.recommendedSubtitle}>{t('challenge.recommended.subtitle')}</Text>
                    </View>

                    {/* Challenge List */}
                    {RECOMMENDED_CHALLENGES.map((challenge, index) => (
                        <TouchableOpacity
                            key={challenge.id}
                            style={[
                                styles.challengeRow,
                                index < RECOMMENDED_CHALLENGES.length - 1 && styles.challengeRowBorder,
                            ]}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconBox, { backgroundColor: challenge.iconBgColor }]}>
                                <Ionicons name={challenge.icon} size={24} color={challenge.iconColor} />
                            </View>
                            <View style={styles.challengeInfo}>
                                <Text style={styles.challengeTitle}>
                                    {t(`challenge.challenges.${challenge.translationKey}.title`)}
                                </Text>
                                <Text style={styles.challengeSubtitle}>
                                    {t(`challenge.challenges.${challenge.translationKey}.subtitle`)}
                                </Text>
                            </View>
                            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Create Custom Button */}
                <TouchableOpacity
                    style={styles.createCustomButton}
                    activeOpacity={0.7}
                    onPress={() => router.push('/challenge-create')}
                >
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                    <Text style={styles.createCustomText}>{t('challenge.createCustom')}</Text>
                </TouchableOpacity>
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
    content: {
        flex: 1,
        padding: spacing.md,
    },
    // Active Challenge Card
    activeChallengeCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        marginBottom: spacing.md,
        ...shadows.card,
    },
    activeChallengeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    activeChallengeInfo: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    activeChallengeTitle: {
        ...typography.body,
        fontWeight: '600',
        color: colors.textStrong,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dDayBadge: {
        backgroundColor: colors.primary + '15',
        paddingHorizontal: spacing.xs,
        paddingVertical: 4,
        borderRadius: radius.sm,
    },
    dDayText: {
        ...typography.caption,
        fontWeight: '600',
        color: colors.primary,
    },
    // Progress Bar
    progressBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    progressBarBackground: {
        flex: 1,
        height: 8,
        backgroundColor: colors.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 4,
    },
    progressText: {
        ...typography.caption,
        fontWeight: '600',
        color: colors.textMedium,
        minWidth: 60,
        textAlign: 'right',
    },
    // Recommended Card
    recommendedCard: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 20,
        marginBottom: spacing.md,
        ...shadows.card,
    },
    recommendedHeader: {
        marginBottom: spacing.sm,
    },
    recommendedTitle: {
        ...typography.heading,
        fontWeight: '700',
        color: colors.textStrong,
    },
    recommendedSubtitle: {
        ...typography.caption,
        color: colors.textWeak,
        marginTop: 4,
    },
    challengeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.sm,
    },
    challengeRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    challengeInfo: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    challengeTitle: {
        ...typography.body,
        fontWeight: '600',
        color: colors.textStrong,
    },
    challengeSubtitle: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 2,
    },
    // Create Custom Button
    createCustomButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.primary + '30',
        borderStyle: 'dashed',
    },
    createCustomText: {
        ...typography.body,
        fontWeight: '600',
        color: colors.primary,
    },
});

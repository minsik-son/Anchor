/**
 * LocaAlert Challenge Landing Screen
 * Browse active and recommended challenges
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';

interface ActiveChallenge {
    id: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBgColor: string;
    progress: number;
    goal: number;
    daysLeft: number;
}

interface RecommendedChallenge {
    id: string;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBgColor: string;
    participants: number;
}

const ACTIVE_CHALLENGE: ActiveChallenge = {
    id: 'active-1',
    title: '헬스장 출석하기',
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
        title: '헬스왕',
        subtitle: '주 3회 방문',
        icon: 'barbell',
        iconColor: '#3182F6',
        iconBgColor: '#E8F3FF',
        participants: 1234,
    },
    {
        id: '2',
        title: '아침 산책',
        subtitle: '매일 공원 방문',
        icon: 'walk',
        iconColor: '#00C853',
        iconBgColor: '#E6F9EE',
        participants: 2345,
    },
    {
        id: '3',
        title: '도서관 집중',
        subtitle: '주 5회 방문',
        icon: 'book',
        iconColor: '#FF9800',
        iconBgColor: '#FFF3E0',
        participants: 987,
    },
    {
        id: '4',
        title: '에코 텀블러',
        subtitle: '매일 카페 방문',
        icon: 'cafe',
        iconColor: '#795548',
        iconBgColor: '#EFEBE9',
        participants: 456,
    },
];

function ProgressBar({ progress, goal, colors }: { progress: number; goal: number; colors: ThemeColors }) {
    const percentage = (progress / goal) * 100;
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
            </View>
            <Text style={styles.progressText}>{progress}/{goal} 완료</Text>
        </View>
    );
}

export default function ChallengeLanding() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>Challenges</Text>
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
                            <Text style={styles.activeChallengeTitle}>{ACTIVE_CHALLENGE.title}</Text>
                        </View>
                        <View style={styles.dDayBadge}>
                            <Text style={styles.dDayText}>D-{ACTIVE_CHALLENGE.daysLeft} 남음</Text>
                        </View>
                    </View>
                    <ProgressBar
                        progress={ACTIVE_CHALLENGE.progress}
                        goal={ACTIVE_CHALLENGE.goal}
                        colors={colors}
                    />
                </TouchableOpacity>

                {/* Recommended Challenges Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>추천 챌린지</Text>
                    <View style={styles.challengesList}>
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
                                    <Ionicons
                                        name={challenge.icon}
                                        size={24}
                                        color={challenge.iconColor}
                                    />
                                </View>
                                <View style={styles.challengeInfo}>
                                    <Text style={styles.challengeTitle}>{challenge.title}</Text>
                                    <Text style={styles.challengeSubtitle}>
                                        {challenge.participants.toLocaleString()}명 참여 중
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Create Custom Button */}
                <TouchableOpacity style={styles.createCustomButton} activeOpacity={0.7}>
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                    <Text style={styles.createCustomText}>나만의 루틴 만들기</Text>
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
    // Section
    section: {
        marginBottom: spacing.md,
    },
    sectionTitle: {
        ...typography.body,
        fontWeight: '700',
        color: colors.textStrong,
        marginBottom: spacing.xs,
    },
    // Challenge List
    challengesList: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        ...shadows.card,
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
        color: colors.textWeak,
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

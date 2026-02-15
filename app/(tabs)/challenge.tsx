/**
 * LocaAlert Challenge Tab
 * Landing page for challenges with 3 state variants:
 * 1. No active challenges → welcome + templates
 * 2. Active challenges → cards + progress
 * 3. Graduated challenges → celebration + CTAs
 */

import { useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, BounceIn } from 'react-native-reanimated';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../../src/styles/theme';
import { useChallengeStore } from '../../src/stores/challengeStore';
import { ChallengeCard } from '../../src/components/challenge/ChallengeCard';

interface RecommendedTemplate {
    id: string;
    translationKey: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBgColor: string;
    weeklyGoal: number;
    durationWeeks: number;
}

const RECOMMENDED_TEMPLATES: RecommendedTemplate[] = [
    {
        id: 'gym',
        translationKey: 'gym',
        icon: 'fitness',
        iconColor: '#3182F6',
        iconBgColor: '#E8F3FF',
        weeklyGoal: 3,
        durationWeeks: 4,
    },
    {
        id: 'walk',
        translationKey: 'walk',
        icon: 'walk',
        iconColor: '#00C853',
        iconBgColor: '#E6F9EE',
        weeklyGoal: 3,
        durationWeeks: 3,
    },
    {
        id: 'study',
        translationKey: 'study',
        icon: 'book',
        iconColor: '#FF9800',
        iconBgColor: '#FFF3E0',
        weeklyGoal: 5,
        durationWeeks: 4,
    },
];

export default function ChallengeTab() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { challenges, activeChallenges, isLoading, loadChallenges } = useChallengeStore();

    useEffect(() => {
        loadChallenges();
    }, []);

    const graduatedChallenges = useMemo(
        () => challenges.filter(c => c.status === 'graduated'),
        [challenges]
    );

    const hasActiveChallenges = activeChallenges.length > 0;
    const hasRecentGraduation = graduatedChallenges.length > 0 && !hasActiveChallenges;
    const canAddMore = activeChallenges.length < 2;

    const handleTemplatePress = useCallback((template: RecommendedTemplate) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
            pathname: '/challenge-create',
            params: {
                templateIcon: template.id,
                templateGoal: String(template.weeklyGoal),
                templateDuration: String(template.durationWeeks),
            },
        });
    }, []);

    const handleCreatePress = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/challenge-create');
    }, []);

    const handleChallengePress = useCallback((challengeId: string) => {
        router.push({ pathname: '/challenge-detail', params: { id: challengeId } });
    }, []);

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 20 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('challenge.headerTitle')}</Text>
                </View>

                {/* Loading state */}
                {isLoading && challenges.length === 0 && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                )}

                {/* State 1: No active challenges */}
                {!hasActiveChallenges && !hasRecentGraduation && (
                    <>
                        <View style={styles.welcomeContainer}>
                            <Text style={styles.welcomeText}>
                                {t('challenge.welcome')}
                            </Text>
                        </View>

                        <View style={styles.recommendedCard}>
                            <View style={styles.recommendedHeader}>
                                <Text style={styles.recommendedTitle}>{t('challenge.recommended.title')}</Text>
                                <Text style={styles.recommendedSubtitle}>{t('challenge.recommended.subtitle')}</Text>
                            </View>

                            {RECOMMENDED_TEMPLATES.map((template, index) => (
                                <TouchableOpacity
                                    key={template.id}
                                    style={[
                                        styles.challengeRow,
                                        index < RECOMMENDED_TEMPLATES.length - 1 && styles.challengeRowBorder,
                                    ]}
                                    activeOpacity={0.7}
                                    onPress={() => handleTemplatePress(template)}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: template.iconBgColor }]}>
                                        <Ionicons name={template.icon} size={24} color={template.iconColor} />
                                    </View>
                                    <View style={styles.challengeInfo}>
                                        <Text style={styles.challengeTitle}>
                                            {t(`challenge.challenges.${template.translationKey}.title`)}
                                        </Text>
                                        <Text style={styles.challengeSubtitle}>
                                            {t(`challenge.challenges.${template.translationKey}.subtitle`)}
                                        </Text>
                                    </View>
                                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}

                {/* State 2: Active challenges */}
                {hasActiveChallenges && (
                    <View style={styles.activeChallengesContainer}>
                        {activeChallenges.map((challenge) => (
                            <ChallengeCard
                                key={challenge.id}
                                challenge={challenge}
                                onPress={() => handleChallengePress(challenge.id)}
                            />
                        ))}
                    </View>
                )}

                {/* State 3: Graduated (no active) */}
                {hasRecentGraduation && (
                    <View style={styles.graduatedContainer}>
                        <Animated.View
                            style={styles.graduatedCard}
                            entering={FadeInDown.duration(600).springify()}
                        >
                            <Animated.View entering={BounceIn.delay(300).duration(800)}>
                                <Ionicons name="trophy" size={48} color="#FFD700" />
                            </Animated.View>
                            <Animated.Text
                                style={styles.graduatedTitle}
                                entering={FadeInUp.delay(500).duration(400)}
                            >
                                {t('challenge.graduated.title')}
                            </Animated.Text>
                            <Animated.Text
                                style={styles.graduatedSubtitle}
                                entering={FadeInUp.delay(700).duration(400)}
                            >
                                {t('challenge.graduated.subtitle')}
                            </Animated.Text>
                            <TouchableOpacity
                                style={styles.newChallengeButton}
                                onPress={handleCreatePress}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.newChallengeButtonText}>
                                    {t('challenge.graduated.newChallenge')}
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                )}

                {/* Recommended section (when active challenges exist but < 2) */}
                {hasActiveChallenges && canAddMore && (
                    <View style={styles.recommendedCard}>
                        <View style={styles.recommendedHeader}>
                            <Text style={styles.recommendedTitle}>{t('challenge.recommended.title')}</Text>
                            <Text style={styles.recommendedSubtitle}>{t('challenge.recommended.subtitle')}</Text>
                        </View>

                        {RECOMMENDED_TEMPLATES.map((template, index) => (
                            <TouchableOpacity
                                key={template.id}
                                style={[
                                    styles.challengeRow,
                                    index < RECOMMENDED_TEMPLATES.length - 1 && styles.challengeRowBorder,
                                ]}
                                activeOpacity={0.7}
                                onPress={() => handleTemplatePress(template)}
                            >
                                <View style={[styles.iconBox, { backgroundColor: template.iconBgColor }]}>
                                    <Ionicons name={template.icon} size={24} color={template.iconColor} />
                                </View>
                                <View style={styles.challengeInfo}>
                                    <Text style={styles.challengeTitle}>
                                        {t(`challenge.challenges.${template.translationKey}.title`)}
                                    </Text>
                                    <Text style={styles.challengeSubtitle}>
                                        {t(`challenge.challenges.${template.translationKey}.subtitle`)}
                                    </Text>
                                </View>
                                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Create custom button */}
                <TouchableOpacity
                    style={styles.createCustomButton}
                    activeOpacity={0.7}
                    onPress={handleCreatePress}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
    },
    header: {
        marginBottom: spacing.md,
    },
    headerTitle: {
        ...typography.display,
        color: colors.textStrong,
    },
    // Welcome (first visit)
    welcomeContainer: {
        marginBottom: spacing.md,
    },
    welcomeText: {
        ...typography.body,
        color: colors.textMedium,
        lineHeight: 22,
    },
    // Active challenges
    activeChallengesContainer: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    // Graduated
    graduatedContainer: {
        marginBottom: spacing.md,
    },
    graduatedCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.lg,
        alignItems: 'center',
        ...shadows.card,
    },
    graduatedTitle: {
        ...typography.heading,
        fontWeight: '700',
        color: colors.textStrong,
        marginTop: spacing.sm,
    },
    graduatedSubtitle: {
        ...typography.body,
        color: colors.textMedium,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    newChallengeButton: {
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: 12,
        paddingHorizontal: spacing.lg,
        marginTop: spacing.md,
    },
    newChallengeButtonText: {
        ...typography.body,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    // Recommended
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
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
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
    // Create button
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

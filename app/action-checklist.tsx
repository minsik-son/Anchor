/**
 * Action Checklist Screen
 * Modal card overlay with selectable action rows and disabled-until-done button
 */

import { useMemo, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlarmStore } from '../src/stores/alarmStore';
import { typography, spacing, radius, useThemeColors, ThemeColors } from '../src/styles/theme';

const STAGGER_BASE_DELAY = 150;
const STAGGER_PER_ITEM = 80;

export default function ActionChecklist() {
    const { alarmId, alarmTitle } = useLocalSearchParams<{ alarmId: string; alarmTitle: string }>();
    const { currentMemos, loadMemos, toggleMemoChecked } = useAlarmStore();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const numericAlarmId = Number(alarmId);

    useEffect(() => {
        if (numericAlarmId) {
            loadMemos(numericAlarmId);
        }
    }, [numericAlarmId]);

    const checkedCount = currentMemos.filter((m) => m.is_checked).length;
    const totalCount = currentMemos.length;
    const remainingCount = totalCount - checkedCount;
    const allChecked = totalCount > 0 && remainingCount === 0;
    const progress = totalCount > 0 ? checkedCount / totalCount : 0;

    const handleToggle = useCallback(async (id: number, currentChecked: boolean) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toggleMemoChecked(id, !currentChecked);
    }, [toggleMemoChecked]);

    const handleDone = useCallback(async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)/home');
    }, []);

    return (
        <View style={styles.container}>
            {/* Dark overlay top — tap to dismiss */}
            <Pressable style={styles.overlayTop} onPress={handleDone} />

            {/* Card from bottom */}
            <View style={[styles.card, { paddingBottom: insets.bottom + spacing.md }]}>
                {/* Handle indicator */}
                <View style={styles.handleBar} />

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('actionChecklist.title')}</Text>
                </View>

                {/* Progress Section */}
                <View style={styles.progressSection}>
                    <Text style={styles.progressText}>
                        {allChecked
                            ? t('actionChecklist.allChecked')
                            : t('actionChecklist.remaining', { count: remainingCount })}
                    </Text>
                    <View style={styles.progressBarTrack}>
                        <Animated.View
                            style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
                            layout={Layout.springify()}
                        />
                    </View>
                </View>

                {/* Selectable Action Rows */}
                <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
                    {currentMemos.map((memo, index) => (
                        <Animated.View
                            key={memo.id}
                            entering={FadeInDown.delay(STAGGER_BASE_DELAY + index * STAGGER_PER_ITEM).springify()}
                        >
                            <Pressable
                                style={[
                                    styles.checklistItem,
                                    memo.is_checked && styles.checklistItemChecked,
                                ]}
                                onPress={() => handleToggle(memo.id, memo.is_checked)}
                            >
                                <Ionicons
                                    name={memo.is_checked ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={24}
                                    color={memo.is_checked ? colors.primary : colors.textWeak}
                                />
                                <Text style={[
                                    styles.checklistText,
                                    memo.is_checked && styles.checklistTextDone,
                                ]}>
                                    {memo.content}
                                </Text>
                            </Pressable>
                        </Animated.View>
                    ))}
                </ScrollView>

                {/* Footer — disabled until all checked */}
                <View style={styles.footerContainer}>
                    <Pressable
                        style={[
                            styles.doneButton,
                            { backgroundColor: allChecked ? colors.success : colors.border },
                        ]}
                        onPress={handleDone}
                        disabled={!allChecked}
                    >
                        <Text style={[
                            styles.doneButtonText,
                            { color: allChecked ? '#FFFFFF' : colors.textWeak },
                        ]}>
                            {t('actionChecklist.done')}
                        </Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    overlayTop: {
        flex: 1,
        minHeight: 120,
    },
    card: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    handleBar: {
        width: 36,
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
    },
    header: {
        alignItems: 'center',
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    headerTitle: {
        ...typography.heading,
        color: colors.textStrong,
        textAlign: 'center',
    },
    progressSection: {
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    progressText: {
        ...typography.caption,
        color: colors.textWeak,
        marginBottom: spacing.xs,
    },
    progressBarTrack: {
        height: 6,
        backgroundColor: colors.border,
        borderRadius: radius.full,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: colors.success,
        borderRadius: radius.full,
    },
    listContainer: {
        paddingHorizontal: spacing.md,
    },
    listContent: {
        gap: spacing.xs,
    },
    checklistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 16,
    },
    checklistItemChecked: {
        backgroundColor: colors.primary + '14',
    },
    checklistText: {
        ...typography.body,
        color: colors.textStrong,
        flex: 1,
    },
    checklistTextDone: {
        color: colors.textWeak,
        textDecorationLine: 'line-through',
    },
    footerContainer: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
    },
    doneButton: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: radius.md,
    },
    doneButtonText: {
        ...typography.body,
        fontWeight: '700',
    },
});

/**
 * Action Checklist Screen
 * Post-arrival checklist displayed after alarm dismissal when memos exist
 */

import { useMemo, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlarmStore } from '../src/stores/alarmStore';
import { typography, spacing, radius, useThemeColors, ThemeColors } from '../src/styles/theme';

const ITEM_HEIGHT = 56;
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
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerSpacer} />
                <Text style={styles.headerTitle}>{t('actionChecklist.title')}</Text>
                <Pressable onPress={handleDone} style={styles.headerDoneButton}>
                    <Text style={styles.headerDoneText}>{t('actionChecklist.done')}</Text>
                </Pressable>
            </View>

            {/* Arrival Success Section */}
            <View style={styles.arrivalSection}>
                <View style={styles.arrivalIconWrapper}>
                    <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                </View>
                <Text style={styles.arrivalSubtitle}>
                    {t('actionChecklist.subtitle', { destination: alarmTitle || '' })}
                </Text>
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

            {/* Checklist Items */}
            <View style={styles.listContainer}>
                {currentMemos.map((memo, index) => (
                    <Animated.View
                        key={memo.id}
                        entering={FadeInDown.delay(STAGGER_BASE_DELAY + index * STAGGER_PER_ITEM).springify()}
                        layout={Layout.springify()}
                    >
                        <Pressable
                            style={styles.checklistItem}
                            onPress={() => handleToggle(memo.id, memo.is_checked)}
                        >
                            <Ionicons
                                name={memo.is_checked ? 'checkbox' : 'square-outline'}
                                size={24}
                                color={memo.is_checked ? colors.success : colors.textWeak}
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
            </View>

            {/* Bottom Done Button */}
            <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + spacing.md }]}>
                <Pressable
                    style={[
                        styles.doneButton,
                        { backgroundColor: allChecked ? colors.success : colors.primary },
                    ]}
                    onPress={handleDone}
                >
                    <Ionicons
                        name={allChecked ? 'checkmark-done' : 'arrow-forward'}
                        size={22}
                        color="#FFFFFF"
                    />
                    <Text style={styles.doneButtonText}>{t('actionChecklist.done')}</Text>
                </Pressable>
            </View>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        height: 56,
    },
    headerSpacer: {
        width: 60,
    },
    headerTitle: {
        ...typography.heading,
        color: colors.textStrong,
        textAlign: 'center',
        flex: 1,
    },
    headerDoneButton: {
        width: 60,
        alignItems: 'flex-end',
    },
    headerDoneText: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '600',
    },
    arrivalSection: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.md,
    },
    arrivalIconWrapper: {
        marginBottom: spacing.sm,
    },
    arrivalSubtitle: {
        ...typography.body,
        color: colors.textMedium,
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
        flex: 1,
        paddingHorizontal: spacing.md,
    },
    checklistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        height: ITEM_HEIGHT,
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
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
    bottomContainer: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
    },
    doneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: radius.md,
        gap: spacing.xs,
    },
    doneButtonText: {
        ...typography.body,
        color: '#FFFFFF',
        fontWeight: '600',
    },
});

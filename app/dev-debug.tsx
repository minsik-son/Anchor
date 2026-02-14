/**
 * Dev Debug Panel
 * Visit simulator, time jump, state override
 * Only available in __DEV__ mode
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';
import { useChallengeStore } from '../src/stores/challengeStore';
import { useDevStore, getEffectiveNow } from '../src/stores/devStore';
import { ChallengeRow } from '../src/db/schema';

export default function DevDebug() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { activeChallenges, loadChallenges, recordVisit, forceUpdateState } = useChallengeStore();
    const { timeOffsetDays, setTimeOffset, resetTimeOffset } = useDevStore();
    const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);

    // State override inputs
    const [comboValue, setComboValue] = useState(0);
    const [chancesValue, setChancesValue] = useState(0);
    const [weekValue, setWeekValue] = useState(1);

    useEffect(() => {
        loadChallenges();
    }, []);

    useEffect(() => {
        if (activeChallenges.length > 0 && !selectedChallengeId) {
            setSelectedChallengeId(activeChallenges[0].id);
        }
    }, [activeChallenges]);

    const selectedChallenge = useMemo(
        () => activeChallenges.find(c => c.id === selectedChallengeId) ?? null,
        [activeChallenges, selectedChallengeId]
    );

    useEffect(() => {
        if (selectedChallenge) {
            setComboValue(selectedChallenge.combo);
            setChancesValue(selectedChallenge.chances);
            setWeekValue(selectedChallenge.current_week);
        }
    }, [selectedChallenge]);

    const handleSimulateVisit = useCallback(async () => {
        if (!selectedChallengeId) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const result = await recordVisit(selectedChallengeId);
        if (result.counted) {
            Alert.alert(t('devDebug.visitSuccess'));
        } else {
            Alert.alert(t('devDebug.visitFailed', { reason: result.reason }));
        }
    }, [selectedChallengeId, recordVisit, t]);

    const handleApplyState = useCallback(async () => {
        if (!selectedChallengeId) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await forceUpdateState(selectedChallengeId, {
            combo: comboValue,
            chances: chancesValue,
            current_week: weekValue,
        });
        Alert.alert('State updated');
    }, [selectedChallengeId, comboValue, chancesValue, weekValue, forceUpdateState]);

    const handleTimeJump = useCallback((days: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeOffset(timeOffsetDays + days);
    }, [timeOffsetDays, setTimeOffset]);

    const effectiveNow = getEffectiveNow();

    if (!__DEV__) {
        return null;
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('devDebug.title')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Challenge Selector */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Challenge</Text>
                    {activeChallenges.length === 0 ? (
                        <Text style={styles.emptyText}>{t('devDebug.noActiveChallenge')}</Text>
                    ) : (
                        <View style={styles.chipRow}>
                            {activeChallenges.map((c) => (
                                <Pressable
                                    key={c.id}
                                    style={[
                                        styles.chip,
                                        selectedChallengeId === c.id && styles.chipSelected,
                                    ]}
                                    onPress={() => setSelectedChallengeId(c.id)}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        selectedChallengeId === c.id && styles.chipTextSelected,
                                    ]}>
                                        {c.name || c.place_name}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </View>

                {/* Time Offset */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('devDebug.timeSection')}</Text>
                    <Text style={styles.infoText}>
                        {t('devDebug.currentTime')}: {effectiveNow.toLocaleString()}
                    </Text>
                    <Text style={styles.infoText}>
                        {t('devDebug.offsetDays', { days: timeOffsetDays })}
                    </Text>
                    <View style={styles.buttonRow}>
                        <Pressable style={styles.actionButton} onPress={() => handleTimeJump(-7)}>
                            <Text style={styles.actionButtonText}>-7d</Text>
                        </Pressable>
                        <Pressable style={styles.actionButton} onPress={() => handleTimeJump(-1)}>
                            <Text style={styles.actionButtonText}>-1d</Text>
                        </Pressable>
                        <Pressable style={styles.actionButton} onPress={() => handleTimeJump(1)}>
                            <Text style={styles.actionButtonText}>+1d</Text>
                        </Pressable>
                        <Pressable style={styles.actionButton} onPress={() => handleTimeJump(7)}>
                            <Text style={styles.actionButtonText}>+7d</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                            onPress={() => { resetTimeOffset(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        >
                            <Text style={[styles.actionButtonText, { color: colors.error }]}>
                                {t('devDebug.resetTime')}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* Visit Simulator */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('devDebug.visitSection')}</Text>
                    <Text style={styles.infoText}>{t('devDebug.simulateVisitDesc')}</Text>
                    <Pressable
                        style={[styles.primaryButton, !selectedChallengeId && styles.primaryButtonDisabled]}
                        onPress={handleSimulateVisit}
                        disabled={!selectedChallengeId}
                    >
                        <Ionicons name="location" size={18} color="#FFFFFF" />
                        <Text style={styles.primaryButtonText}>{t('devDebug.simulateVisit')}</Text>
                    </Pressable>
                </View>

                {/* State Override */}
                {selectedChallenge && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('devDebug.stateSection')}</Text>

                        {/* Combo */}
                        <View style={styles.overrideRow}>
                            <Text style={styles.overrideLabel}>{t('devDebug.combo')}</Text>
                            <View style={styles.stepperRow}>
                                <Pressable style={styles.stepperBtn} onPress={() => setComboValue(Math.max(0, comboValue - 1))}>
                                    <Ionicons name="remove" size={20} color={colors.textStrong} />
                                </Pressable>
                                <Text style={styles.stepperValue}>{comboValue}</Text>
                                <Pressable style={styles.stepperBtn} onPress={() => setComboValue(comboValue + 1)}>
                                    <Ionicons name="add" size={20} color={colors.textStrong} />
                                </Pressable>
                            </View>
                        </View>

                        {/* Chances */}
                        <View style={styles.overrideRow}>
                            <Text style={styles.overrideLabel}>{t('devDebug.chances')}</Text>
                            <View style={styles.stepperRow}>
                                <Pressable style={styles.stepperBtn} onPress={() => setChancesValue(Math.max(0, chancesValue - 1))}>
                                    <Ionicons name="remove" size={20} color={colors.textStrong} />
                                </Pressable>
                                <Text style={styles.stepperValue}>{chancesValue}</Text>
                                <Pressable style={styles.stepperBtn} onPress={() => setChancesValue(chancesValue + 1)}>
                                    <Ionicons name="add" size={20} color={colors.textStrong} />
                                </Pressable>
                            </View>
                        </View>

                        {/* Week */}
                        <View style={styles.overrideRow}>
                            <Text style={styles.overrideLabel}>{t('devDebug.week')}</Text>
                            <View style={styles.stepperRow}>
                                <Pressable style={styles.stepperBtn} onPress={() => setWeekValue(Math.max(1, weekValue - 1))}>
                                    <Ionicons name="remove" size={20} color={colors.textStrong} />
                                </Pressable>
                                <Text style={styles.stepperValue}>{weekValue}</Text>
                                <Pressable style={styles.stepperBtn} onPress={() => setWeekValue(weekValue + 1)}>
                                    <Ionicons name="add" size={20} color={colors.textStrong} />
                                </Pressable>
                            </View>
                        </View>

                        <Pressable style={styles.primaryButton} onPress={handleApplyState}>
                            <Text style={styles.primaryButtonText}>{t('devDebug.apply')}</Text>
                        </Pressable>
                    </View>
                )}
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
    section: {
        margin: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        ...shadows.card,
    },
    sectionTitle: {
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
    infoText: {
        ...typography.caption,
        color: colors.textMedium,
        marginBottom: spacing.xs,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    chip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.sm,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    chipSelected: {
        backgroundColor: colors.primary + '15',
        borderColor: colors.primary,
    },
    chipText: {
        ...typography.caption,
        color: colors.textMedium,
    },
    chipTextSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    buttonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    actionButton: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.sm,
        backgroundColor: colors.background,
    },
    actionButtonText: {
        ...typography.caption,
        fontWeight: '600',
        color: colors.primary,
    },
    primaryButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: 12,
        marginTop: spacing.sm,
    },
    primaryButtonDisabled: {
        backgroundColor: colors.border,
    },
    primaryButtonText: {
        ...typography.body,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    overrideRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    overrideLabel: {
        ...typography.body,
        color: colors.textStrong,
    },
    stepperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    stepperBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperValue: {
        ...typography.body,
        fontWeight: '700',
        color: colors.textStrong,
        minWidth: 30,
        textAlign: 'center',
    },
});

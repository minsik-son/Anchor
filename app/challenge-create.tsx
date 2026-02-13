/**
 * LocaAlert Challenge Create Screen
 * Form page for users to configure their own location-based challenge goals
 */

import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';

type DurationType = 'week' | 'month';

interface ChallengeIcon {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bgColor: string;
}

const CHALLENGE_ICONS: ChallengeIcon[] = [
    { key: 'fitness', icon: 'fitness', color: '#3182F6', bgColor: '#E8F3FF' },
    { key: 'walk', icon: 'walk', color: '#00C853', bgColor: '#E6F9EE' },
    { key: 'book', icon: 'book', color: '#FF9800', bgColor: '#FFF3E0' },
    { key: 'cafe', icon: 'cafe', color: '#795548', bgColor: '#EFEBE9' },
    { key: 'bicycle', icon: 'bicycle', color: '#9C27B0', bgColor: '#F3E5F5' },
];

const MIN_FREQUENCY = 1;
const MAX_FREQUENCY = 7;
const DEFAULT_FREQUENCY = 3;

export default function ChallengeCreate() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [locationName, setLocationName] = useState<string | null>(null);
    const [locationAddress, setLocationAddress] = useState<string | null>(null);
    const [duration, setDuration] = useState<DurationType>('week');
    const [frequency, setFrequency] = useState(DEFAULT_FREQUENCY);
    const [isRepeat, setIsRepeat] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState('fitness');
    const [name, setName] = useState('');

    const isFormValid = locationName !== null;

    const handleLocationSelect = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Mock location selection for now
        setLocationName('스타벅스 강남점');
        setLocationAddress('서울시 강남구 강남대로 390');
    }, []);

    const handleDurationChange = useCallback((newDuration: DurationType) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setDuration(newDuration);
    }, []);

    const handleFrequencyChange = useCallback((delta: number) => {
        const newValue = frequency + delta;
        if (newValue >= MIN_FREQUENCY && newValue <= MAX_FREQUENCY) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setFrequency(newValue);
        }
    }, [frequency]);

    const handleIconSelect = useCallback((iconKey: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedIcon(iconKey);
    }, []);

    const handleStart = useCallback(() => {
        if (!isFormValid) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // TODO: Save challenge and navigate
        router.back();
    }, [isFormValid]);

    const selectedIconData = CHALLENGE_ICONS.find(i => i.key === selectedIcon) || CHALLENGE_ICONS[0];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('challengeCreate.title')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Section 1: Location */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>{t('challengeCreate.location.label')}</Text>
                </View>
                <Pressable
                    style={[
                        styles.card,
                        !locationName && styles.locationEmptyCard,
                    ]}
                    onPress={handleLocationSelect}
                >
                    {locationName ? (
                        <View style={styles.locationSelectedContent}>
                            <View style={styles.locationInfo}>
                                <Text style={styles.locationName}>{locationName}</Text>
                                <Text style={styles.locationAddress}>{locationAddress}</Text>
                            </View>
                            <Pressable style={styles.changeButton} onPress={handleLocationSelect}>
                                <Text style={styles.changeButtonText}>
                                    {t('challengeCreate.location.change')}
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.locationEmptyContent}>
                            <View style={styles.locationEmptyIcon}>
                                <Ionicons name="add" size={32} color={colors.primary} />
                            </View>
                            <Text style={styles.locationEmptyText}>
                                {t('challengeCreate.location.select')}
                            </Text>
                        </View>
                    )}
                </Pressable>

                {/* Section 2: Goal Settings */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>{t('challengeCreate.goal.label')}</Text>
                </View>
                <View style={styles.card}>
                    {/* Duration Tabs */}
                    <Text style={styles.fieldLabel}>{t('challengeCreate.goal.duration')}</Text>
                    <View style={styles.segmentContainer}>
                        <Pressable
                            style={[
                                styles.segmentButton,
                                duration === 'week' && styles.segmentButtonActive,
                            ]}
                            onPress={() => handleDurationChange('week')}
                        >
                            <Text style={[
                                styles.segmentButtonText,
                                duration === 'week' && styles.segmentButtonTextActive,
                            ]}>
                                {t('challengeCreate.goal.week')}
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.segmentButton,
                                duration === 'month' && styles.segmentButtonActive,
                            ]}
                            onPress={() => handleDurationChange('month')}
                        >
                            <Text style={[
                                styles.segmentButtonText,
                                duration === 'month' && styles.segmentButtonTextActive,
                            ]}>
                                {t('challengeCreate.goal.month')}
                            </Text>
                        </Pressable>
                    </View>

                    {/* Frequency Stepper */}
                    <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                        {t('challengeCreate.goal.frequency')}
                    </Text>
                    <View style={styles.stepperContainer}>
                        <Pressable
                            style={[
                                styles.stepperButton,
                                frequency <= MIN_FREQUENCY && styles.stepperButtonDisabled,
                            ]}
                            onPress={() => handleFrequencyChange(-1)}
                            disabled={frequency <= MIN_FREQUENCY}
                        >
                            <Ionicons
                                name="remove"
                                size={24}
                                color={frequency <= MIN_FREQUENCY ? colors.textWeak : colors.textStrong}
                            />
                        </Pressable>
                        <Text style={styles.stepperValue}>
                            {t('challengeCreate.goal.timesPerWeek', { count: frequency })}
                        </Text>
                        <Pressable
                            style={[
                                styles.stepperButton,
                                frequency >= MAX_FREQUENCY && styles.stepperButtonDisabled,
                            ]}
                            onPress={() => handleFrequencyChange(1)}
                            disabled={frequency >= MAX_FREQUENCY}
                        >
                            <Ionicons
                                name="add"
                                size={24}
                                color={frequency >= MAX_FREQUENCY ? colors.textWeak : colors.textStrong}
                            />
                        </Pressable>
                    </View>

                    {/* Repeat Toggle */}
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>{t('challengeCreate.goal.repeat')}</Text>
                        <Switch
                            value={isRepeat}
                            onValueChange={setIsRepeat}
                            trackColor={{ false: colors.border, true: colors.primary + '80' }}
                            thumbColor={isRepeat ? colors.primary : colors.surface}
                        />
                    </View>
                </View>

                {/* Section 3: Identity */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>{t('challengeCreate.identity.iconLabel')}</Text>
                </View>
                <View style={styles.card}>
                    {/* Icon Picker */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.iconPickerContainer}
                    >
                        {CHALLENGE_ICONS.map((item) => (
                            <Pressable
                                key={item.key}
                                style={[
                                    styles.iconPickerItem,
                                    { backgroundColor: item.bgColor },
                                    selectedIcon === item.key && styles.iconPickerItemSelected,
                                ]}
                                onPress={() => handleIconSelect(item.key)}
                            >
                                <Ionicons name={item.icon} size={28} color={item.color} />
                            </Pressable>
                        ))}
                    </ScrollView>

                    {/* Name Input */}
                    <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                        {t('challengeCreate.identity.nameLabel')}
                    </Text>
                    <TextInput
                        style={styles.nameInput}
                        placeholder={t('challengeCreate.identity.namePlaceholder')}
                        placeholderTextColor={colors.textWeak}
                        value={name}
                        onChangeText={setName}
                    />
                </View>
            </ScrollView>

            {/* Footer CTA */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
                <Pressable
                    style={[
                        styles.startButton,
                        !isFormValid && styles.startButtonDisabled,
                    ]}
                    onPress={handleStart}
                    disabled={!isFormValid}
                >
                    <Text style={[
                        styles.startButtonText,
                        !isFormValid && styles.startButtonTextDisabled,
                    ]}>
                        {t('challengeCreate.start')}
                    </Text>
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
    sectionHeader: {
        marginBottom: spacing.xs,
    },
    sectionLabel: {
        ...typography.caption,
        color: colors.textMedium,
        fontWeight: '600',
        marginLeft: 4,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: spacing.md,
        marginBottom: spacing.md,
        ...shadows.card,
    },
    // Location Empty State
    locationEmptyCard: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.border,
        ...shadows.card,
        shadowOpacity: 0,
        elevation: 0,
    },
    locationEmptyContent: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 100,
        gap: spacing.xs,
    },
    locationEmptyIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationEmptyText: {
        ...typography.body,
        color: colors.textMedium,
    },
    // Location Selected State
    locationSelectedContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationInfo: {
        flex: 1,
    },
    locationName: {
        ...typography.body,
        fontWeight: '600',
        color: colors.textStrong,
    },
    locationAddress: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 4,
    },
    changeButton: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        backgroundColor: colors.background,
        borderRadius: radius.sm,
    },
    changeButtonText: {
        ...typography.caption,
        fontWeight: '600',
        color: colors.primary,
    },
    // Field Labels
    fieldLabel: {
        ...typography.caption,
        color: colors.textMedium,
        fontWeight: '500',
        marginBottom: spacing.xs,
    },
    // Segmented Control
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: colors.background,
        borderRadius: radius.md,
        padding: 4,
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: radius.md - 2,
        alignItems: 'center',
    },
    segmentButtonActive: {
        backgroundColor: colors.primary,
    },
    segmentButtonText: {
        ...typography.body,
        fontWeight: '600',
        color: colors.textMedium,
    },
    segmentButtonTextActive: {
        color: '#FFFFFF',
    },
    // Stepper
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        paddingVertical: spacing.xs,
    },
    stepperButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperButtonDisabled: {
        opacity: 0.5,
    },
    stepperValue: {
        ...typography.display,
        color: colors.textStrong,
        minWidth: 80,
        textAlign: 'center',
    },
    // Toggle Row
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    toggleLabel: {
        ...typography.body,
        color: colors.textStrong,
    },
    // Icon Picker
    iconPickerContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingVertical: 4,
    },
    iconPickerItem: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    iconPickerItemSelected: {
        borderColor: colors.primary,
    },
    // Name Input
    nameInput: {
        ...typography.body,
        color: colors.textStrong,
        backgroundColor: colors.background,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 12,
    },
    // Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    startButton: {
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: 16,
        alignItems: 'center',
    },
    startButtonDisabled: {
        backgroundColor: colors.border,
    },
    startButtonText: {
        ...typography.body,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    startButtonTextDisabled: {
        color: colors.textWeak,
    },
});

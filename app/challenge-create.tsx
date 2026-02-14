/**
 * LocaAlert Challenge Create Screen
 * Full form: location, icon, name, weekly goal, day-specific, duration, repeat, dwell time
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';
import { ChallengeIcon } from '../src/db/schema';
import { useChallengeStore, indexToDayOfWeek } from '../src/stores/challengeStore';
import { DayChips } from '../src/components/common/DayChips';

interface IconOption {
    key: ChallengeIcon;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bgColor: string;
}

const CHALLENGE_ICONS: IconOption[] = [
    { key: 'fitness', icon: 'fitness', color: '#3182F6', bgColor: '#E8F3FF' },
    { key: 'walk', icon: 'walk', color: '#00C853', bgColor: '#E6F9EE' },
    { key: 'book', icon: 'book', color: '#FF9800', bgColor: '#FFF3E0' },
    { key: 'cafe', icon: 'cafe', color: '#795548', bgColor: '#EFEBE9' },
    { key: 'bicycle', icon: 'bicycle', color: '#9C27B0', bgColor: '#F3E5F5' },
];

const DWELL_PRESETS = [15, 30, 60, 120] as const;

const MIN_GOAL = 1;
const MAX_GOAL = 7;
const DEFAULT_GOAL = 3;
const MIN_DURATION = 1;
const MAX_DURATION = 8;
const DEFAULT_DURATION = 3;
const DEFAULT_RADIUS = 200;

export default function ChallengeCreate() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const params = useLocalSearchParams<{
        placeName?: string;
        placeAddress?: string;
        placeLatitude?: string;
        placeLongitude?: string;
        templateIcon?: string;
        templateGoal?: string;
        templateDuration?: string;
    }>();

    const { createChallenge, canCreateChallenge } = useChallengeStore();

    // Form state
    const [locationName, setLocationName] = useState<string | null>(null);
    const [locationAddress, setLocationAddress] = useState<string | null>(null);
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [selectedIcon, setSelectedIcon] = useState<ChallengeIcon>('fitness');
    const [name, setName] = useState('');
    const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_GOAL);
    const [isDaySpecific, setIsDaySpecific] = useState(false);
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [durationWeeks, setDurationWeeks] = useState(DEFAULT_DURATION);
    const [isRepeat, setIsRepeat] = useState(false);
    const [isDwellEnabled, setIsDwellEnabled] = useState(false);
    const [dwellMinutes, setDwellMinutes] = useState<number>(30);

    // Apply template params
    useEffect(() => {
        if (params.templateIcon) {
            setSelectedIcon(params.templateIcon as ChallengeIcon);
        }
        if (params.templateGoal) {
            setWeeklyGoal(Number(params.templateGoal));
        }
        if (params.templateDuration) {
            setDurationWeeks(Number(params.templateDuration));
        }
    }, []);

    // Apply location params from picker
    useEffect(() => {
        if (params.placeName && params.placeLatitude && params.placeLongitude) {
            setLocationName(params.placeName);
            setLocationAddress(params.placeAddress || null);
            setLatitude(Number(params.placeLatitude));
            setLongitude(Number(params.placeLongitude));
        }
    }, [params.placeName, params.placeLatitude, params.placeLongitude]);

    // Validation
    const daySpecificError = isDaySpecific && selectedDays.length !== weeklyGoal;
    const isFormValid = locationName !== null && latitude !== null && longitude !== null &&
        (!isDaySpecific || selectedDays.length === weeklyGoal);

    const handleLocationSelect = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/challenge-location-picker');
    }, []);

    const handleGoalChange = useCallback((delta: number) => {
        const newValue = weeklyGoal + delta;
        if (newValue >= MIN_GOAL && newValue <= MAX_GOAL) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setWeeklyGoal(newValue);
            // Reset day-specific selection when goal changes
            if (isDaySpecific) {
                setSelectedDays([]);
            }
        }
    }, [weeklyGoal, isDaySpecific]);

    const handleDurationChange = useCallback((delta: number) => {
        const newValue = durationWeeks + delta;
        if (newValue >= MIN_DURATION && newValue <= MAX_DURATION) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setDurationWeeks(newValue);
        }
    }, [durationWeeks]);

    const handleIconSelect = useCallback((iconKey: ChallengeIcon) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedIcon(iconKey);
    }, []);

    const handleDaySpecificToggle = useCallback((value: boolean) => {
        setIsDaySpecific(value);
        if (!value) {
            setSelectedDays([]);
        }
    }, []);

    const handleDwellToggle = useCallback((value: boolean) => {
        setIsDwellEnabled(value);
        if (!value) {
            setDwellMinutes(30);
        }
    }, []);

    const handleStart = useCallback(async () => {
        if (!isFormValid || !latitude || !longitude || !locationName) return;

        if (!canCreateChallenge()) {
            Alert.alert(
                t('challenge.limitTitle'),
                t('challenge.limitMessage'),
            );
            return;
        }

        try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            const days = isDaySpecific
                ? selectedDays.map(indexToDayOfWeek)
                : undefined;

            await createChallenge({
                name: name || undefined,
                icon: selectedIcon,
                latitude,
                longitude,
                radius: DEFAULT_RADIUS,
                place_name: locationName,
                weekly_goal: weeklyGoal,
                day_specific: isDaySpecific,
                days,
                duration_weeks: durationWeeks,
                repeat_mode: isRepeat,
                dwell_time_enabled: isDwellEnabled,
                dwell_time_minutes: isDwellEnabled ? dwellMinutes : null,
            });

            router.navigate('/(tabs)/challenge');
        } catch (error) {
            if ((error as Error).message === 'MAX_ACTIVE_LIMIT') {
                Alert.alert(t('challenge.limitTitle'), t('challenge.limitMessage'));
            } else {
                Alert.alert(t('common.error'), t('common.saveFailed'));
            }
        }
    }, [
        isFormValid, latitude, longitude, locationName, canCreateChallenge,
        name, selectedIcon, weeklyGoal, isDaySpecific, selectedDays,
        durationWeeks, isRepeat, isDwellEnabled, dwellMinutes, createChallenge, t,
    ]);

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
                    style={[styles.card, !locationName && styles.locationEmptyCard]}
                    onPress={handleLocationSelect}
                >
                    {locationName ? (
                        <View style={styles.locationSelectedContent}>
                            <View style={styles.locationInfo}>
                                <Text style={styles.locationName}>{locationName}</Text>
                                {locationAddress && (
                                    <Text style={styles.locationAddress}>{locationAddress}</Text>
                                )}
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

                {/* Section 2: Icon */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>{t('challengeCreate.identity.iconLabel')}</Text>
                </View>
                <View style={styles.card}>
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
                        placeholder={locationName || t('challengeCreate.identity.namePlaceholder')}
                        placeholderTextColor={colors.textWeak}
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                {/* Section 3: Goal Settings */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>{t('challengeCreate.goal.label')}</Text>
                </View>
                <View style={styles.card}>
                    {/* Weekly Goal Stepper */}
                    <Text style={styles.fieldLabel}>{t('challengeCreate.goal.frequency')}</Text>
                    <View style={styles.stepperContainer}>
                        <Pressable
                            style={[styles.stepperButton, weeklyGoal <= MIN_GOAL && styles.stepperButtonDisabled]}
                            onPress={() => handleGoalChange(-1)}
                            disabled={weeklyGoal <= MIN_GOAL}
                        >
                            <Ionicons
                                name="remove"
                                size={24}
                                color={weeklyGoal <= MIN_GOAL ? colors.textWeak : colors.textStrong}
                            />
                        </Pressable>
                        <Text style={styles.stepperValue}>
                            {t('challengeCreate.goal.timesPerWeek', { count: weeklyGoal })}
                        </Text>
                        <Pressable
                            style={[styles.stepperButton, weeklyGoal >= MAX_GOAL && styles.stepperButtonDisabled]}
                            onPress={() => handleGoalChange(1)}
                            disabled={weeklyGoal >= MAX_GOAL}
                        >
                            <Ionicons
                                name="add"
                                size={24}
                                color={weeklyGoal >= MAX_GOAL ? colors.textWeak : colors.textStrong}
                            />
                        </Pressable>
                    </View>

                    {/* Day-Specific Toggle */}
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleLabelContainer}>
                            <Text style={styles.toggleLabel}>{t('challengeCreate.goal.daySpecific')}</Text>
                            <Text style={styles.toggleDescription}>{t('challengeCreate.goal.daySpecificDesc')}</Text>
                        </View>
                        <Switch
                            value={isDaySpecific}
                            onValueChange={handleDaySpecificToggle}
                            trackColor={{ false: colors.textMedium, true: colors.primary }}
                            ios_backgroundColor={colors.textMedium}
                        />
                    </View>

                    {/* Day Chips (when day-specific is ON) */}
                    {isDaySpecific && (
                        <View style={styles.dayChipsContainer}>
                            <DayChips selectedDays={selectedDays} onDaysChange={setSelectedDays} />
                            {daySpecificError && (
                                <Text style={styles.daySpecificError}>
                                    {t('challengeCreate.goal.daySpecificError', {
                                        selected: selectedDays.length,
                                        required: weeklyGoal,
                                    })}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Duration Stepper */}
                    <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                        <Text style={styles.fieldLabel}>{t('challengeCreate.goal.duration')}</Text>
                    </View>
                    <View style={styles.stepperContainer}>
                        <Pressable
                            style={[styles.stepperButton, durationWeeks <= MIN_DURATION && styles.stepperButtonDisabled]}
                            onPress={() => handleDurationChange(-1)}
                            disabled={durationWeeks <= MIN_DURATION}
                        >
                            <Ionicons
                                name="remove"
                                size={24}
                                color={durationWeeks <= MIN_DURATION ? colors.textWeak : colors.textStrong}
                            />
                        </Pressable>
                        <Text style={styles.stepperValue}>
                            {t('challengeCreate.goal.weeksCount', { count: durationWeeks })}
                        </Text>
                        <Pressable
                            style={[styles.stepperButton, durationWeeks >= MAX_DURATION && styles.stepperButtonDisabled]}
                            onPress={() => handleDurationChange(1)}
                            disabled={durationWeeks >= MAX_DURATION}
                        >
                            <Ionicons
                                name="add"
                                size={24}
                                color={durationWeeks >= MAX_DURATION ? colors.textWeak : colors.textStrong}
                            />
                        </Pressable>
                    </View>

                    {/* Repeat Toggle */}
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>{t('challengeCreate.goal.repeat')}</Text>
                        <Switch
                            value={isRepeat}
                            onValueChange={setIsRepeat}
                            trackColor={{ false: colors.textMedium, true: colors.primary }}
                            ios_backgroundColor={colors.textMedium}
                        />
                    </View>
                </View>

                {/* Section 4: Dwell Time */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>{t('challengeCreate.dwell.label')}</Text>
                </View>
                <View style={styles.card}>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleLabelContainer}>
                            <Text style={styles.toggleLabel}>{t('challengeCreate.dwell.toggle')}</Text>
                            <Text style={styles.toggleDescription}>{t('challengeCreate.dwell.description')}</Text>
                        </View>
                        <Switch
                            value={isDwellEnabled}
                            onValueChange={handleDwellToggle}
                            trackColor={{ false: colors.textMedium, true: colors.primary }}
                            ios_backgroundColor={colors.textMedium}
                        />
                    </View>

                    {isDwellEnabled && (
                        <View style={styles.dwellPresetsContainer}>
                            {DWELL_PRESETS.map((preset) => (
                                <Pressable
                                    key={preset}
                                    style={[
                                        styles.dwellPresetChip,
                                        dwellMinutes === preset && styles.dwellPresetChipSelected,
                                    ]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setDwellMinutes(preset);
                                    }}
                                >
                                    <Text style={[
                                        styles.dwellPresetText,
                                        dwellMinutes === preset && styles.dwellPresetTextSelected,
                                    ]}>
                                        {preset >= 60
                                            ? t('challengeCreate.dwell.hours', { count: preset / 60 })
                                            : t('challengeCreate.dwell.minutes', { count: preset })}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Footer CTA */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
                <Pressable
                    style={[styles.startButton, !isFormValid && styles.startButtonDisabled]}
                    onPress={handleStart}
                    disabled={!isFormValid}
                >
                    <Text style={[styles.startButtonText, !isFormValid && styles.startButtonTextDisabled]}>
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
    // Location
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
    // Fields
    fieldLabel: {
        ...typography.caption,
        color: colors.textMedium,
        fontWeight: '500',
        marginBottom: spacing.xs,
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
    // Toggle
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
    },
    toggleLabelContainer: {
        flex: 1,
        marginRight: spacing.sm,
    },
    toggleLabel: {
        ...typography.body,
        color: colors.textStrong,
    },
    toggleDescription: {
        ...typography.caption,
        color: colors.textWeak,
        marginTop: 2,
    },
    // Day chips
    dayChipsContainer: {
        marginTop: spacing.sm,
    },
    daySpecificError: {
        ...typography.caption,
        color: colors.error,
        marginTop: spacing.xs,
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
    // Dwell presets
    dwellPresetsContainer: {
        flexDirection: 'row',
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    dwellPresetChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: radius.sm,
        backgroundColor: colors.background,
        alignItems: 'center',
    },
    dwellPresetChipSelected: {
        backgroundColor: colors.primary,
    },
    dwellPresetText: {
        ...typography.caption,
        fontWeight: '600',
        color: colors.textMedium,
    },
    dwellPresetTextSelected: {
        color: '#FFFFFF',
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

/**
 * LocaAlert Routine Setup Screen
 * Form for creating/editing recurring location-based alarms
 */

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';
import { DayChips } from '../src/components/common/DayChips';
import { TimePicker } from '../src/components/common/TimePicker';
import { useRoutineStore } from '../src/stores/routineStore';

const ROUTINE_ICONS = [
    { key: 'business', icon: 'business' },
    { key: 'home', icon: 'home' },
    { key: 'school', icon: 'school' },
    { key: 'fitness', icon: 'fitness' },
    { key: 'restaurant', icon: 'restaurant' },
    { key: 'cafe', icon: 'cafe' },
    { key: 'train', icon: 'train' },
    { key: 'car', icon: 'car' },
] as const;

const SOUND_OPTIONS = [
    { key: 'breeze', label: 'sounds.breeze' },
    { key: 'alert', label: 'sounds.alert' },
    { key: 'digital', label: 'sounds.digital' },
    { key: 'crystal', label: 'sounds.crystal' },
] as const;

export default function RoutineSetup() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ routineId?: string }>();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { routines, createRoutine, updateRoutine } = useRoutineStore();

    // Find existing routine if editing
    const existingRoutine = params.routineId
        ? routines.find(r => r.id === params.routineId)
        : undefined;

    // Form state
    const [name, setName] = useState(existingRoutine?.name || '');
    const [selectedIcon, setSelectedIcon] = useState(existingRoutine?.icon || 'business');
    const [locationName, setLocationName] = useState(existingRoutine?.locationName || '');
    const [startTime, setStartTime] = useState(existingRoutine?.startTime || '08:00');
    const [endTime, setEndTime] = useState(existingRoutine?.endTime || '09:00');
    const [repeatDays, setRepeatDays] = useState<number[]>(existingRoutine?.repeatDays || [1, 2, 3, 4, 5]);
    const [sound, setSound] = useState(existingRoutine?.sound || 'breeze');
    const [memo, setMemo] = useState(existingRoutine?.memo || '');

    // Time picker modal state
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);

    const handleIconSelect = (iconKey: string) => {
        setSelectedIcon(iconKey);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleSoundSelect = (soundKey: string) => {
        setSound(soundKey);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleSelectLocation = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // In a real app, this would navigate to a location picker
        // For now, we'll just set a mock location
        setLocationName(t('routineSetup.defaultLocation'));
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert(t('routineSetup.noName'), t('routineSetup.pleaseEnterName'));
            return;
        }

        if (!locationName.trim()) {
            Alert.alert(t('routineSetup.noLocation'), t('routineSetup.pleaseSelectLocation'));
            return;
        }

        try {
            if (existingRoutine) {
                await updateRoutine(Number(existingRoutine.id), {
                    name: name.trim(),
                    icon: selectedIcon,
                    location_name: locationName,
                    latitude: existingRoutine.latitude,
                    longitude: existingRoutine.longitude,
                    start_time: startTime,
                    end_time: endTime,
                    repeat_days: repeatDays,
                    sound,
                    memo,
                });
            } else {
                // Default coords (서울역) until location picker is fully implemented
                await createRoutine({
                    name: name.trim(),
                    icon: selectedIcon,
                    location_name: locationName,
                    latitude: 37.5547,
                    longitude: 126.9707,
                    start_time: startTime,
                    end_time: endTime,
                    repeat_days: repeatDays,
                    sound,
                    memo,
                });
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
        } catch (error) {
            console.error('[RoutineSetup] Save failed:', error);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Ionicons name="close" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('routineSetup.title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Name Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('routineSetup.nameLabel')}</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder={t('routineSetup.namePlaceholder')}
                        placeholderTextColor={colors.textWeak}
                    />
                </View>

                {/* Icon Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('routineSetup.iconLabel')}</Text>
                    <View style={styles.iconGrid}>
                        {ROUTINE_ICONS.map((item) => (
                            <Pressable
                                key={item.key}
                                style={[
                                    styles.iconOption,
                                    selectedIcon === item.icon && styles.iconOptionSelected,
                                ]}
                                onPress={() => handleIconSelect(item.icon)}
                            >
                                <Ionicons
                                    name={item.icon as any}
                                    size={24}
                                    color={selectedIcon === item.icon ? colors.primary : colors.textMedium}
                                />
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Location Selector */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('routineSetup.locationLabel')}</Text>
                    <Pressable style={styles.locationButton} onPress={handleSelectLocation}>
                        <Ionicons name="location" size={20} color={colors.primary} />
                        <Text style={[styles.locationText, !locationName && styles.locationPlaceholder]}>
                            {locationName || t('routineSetup.selectLocation')}
                        </Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                    </Pressable>
                </View>

                {/* Time Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('routineSetup.timeLabel')}</Text>
                    <View style={styles.timeRow}>
                        <Pressable
                            style={styles.timeButton}
                            onPress={() => setShowStartTimePicker(true)}
                        >
                            <Text style={styles.timeLabel}>{t('routineSetup.startTime')}</Text>
                            <Text style={styles.timeValue}>{startTime}</Text>
                        </Pressable>
                        <Text style={styles.timeSeparator}>~</Text>
                        <Pressable
                            style={styles.timeButton}
                            onPress={() => setShowEndTimePicker(true)}
                        >
                            <Text style={styles.timeLabel}>{t('routineSetup.endTime')}</Text>
                            <Text style={styles.timeValue}>{endTime}</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Repeat Days */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('routineSetup.repeatLabel')}</Text>
                    <DayChips selectedDays={repeatDays} onDaysChange={setRepeatDays} />
                </View>

                {/* Sound Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('routineSetup.soundLabel')}</Text>
                    <View style={styles.soundGrid}>
                        {SOUND_OPTIONS.map((item) => (
                            <Pressable
                                key={item.key}
                                style={[
                                    styles.soundOption,
                                    sound === item.key && styles.soundOptionSelected,
                                ]}
                                onPress={() => handleSoundSelect(item.key)}
                            >
                                <Ionicons
                                    name={sound === item.key ? 'musical-notes' : 'musical-notes-outline'}
                                    size={18}
                                    color={sound === item.key ? colors.primary : colors.textMedium}
                                />
                                <Text style={[
                                    styles.soundLabel,
                                    sound === item.key && styles.soundLabelSelected,
                                ]}>
                                    {t(`settings.${item.label}`)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Memo */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('routineSetup.memoLabel')}</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={memo}
                        onChangeText={setMemo}
                        placeholder={t('routineSetup.memoPlaceholder')}
                        placeholderTextColor={colors.textWeak}
                        multiline
                    />
                </View>

                {/* Spacer for footer */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
                <Pressable
                    style={({ pressed }) => [
                        styles.saveButton,
                        pressed && styles.saveButtonPressed,
                    ]}
                    onPress={handleSave}
                >
                    <Text style={styles.saveButtonText}>{t('routineSetup.save')}</Text>
                </Pressable>
            </View>

            {/* Time Pickers */}
            <TimePicker
                visible={showStartTimePicker}
                value={startTime}
                onConfirm={(time) => {
                    setStartTime(time);
                    setShowStartTimePicker(false);
                }}
                onCancel={() => setShowStartTimePicker(false)}
            />
            <TimePicker
                visible={showEndTimePicker}
                value={endTime}
                onConfirm={(time) => {
                    setEndTime(time);
                    setShowEndTimePicker(false);
                }}
                onCancel={() => setShowEndTimePicker(false)}
            />
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
        borderBottomColor: colors.background,
    },
    headerTitle: {
        ...typography.heading,
        color: colors.textStrong,
    },
    content: {
        flex: 1,
        padding: spacing.md,
    },
    section: {
        marginBottom: spacing.md,
    },
    label: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        ...typography.body,
        color: colors.textStrong,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    // Icon Grid
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    iconOption: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 48,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    iconOptionSelected: {
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}10`,
    },
    // Location
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        gap: spacing.xs,
    },
    locationText: {
        ...typography.body,
        color: colors.textStrong,
        flex: 1,
    },
    locationPlaceholder: {
        color: colors.textWeak,
    },
    // Time
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    timeButton: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        alignItems: 'center',
    },
    timeLabel: {
        ...typography.caption,
        color: colors.textWeak,
        marginBottom: 4,
    },
    timeValue: {
        ...typography.heading,
        color: colors.primary,
    },
    timeSeparator: {
        ...typography.body,
        color: colors.textWeak,
    },
    // Sound
    soundGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    soundOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    soundOptionSelected: {
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}10`,
    },
    soundLabel: {
        ...typography.body,
        color: colors.textMedium,
    },
    soundLabelSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    // Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.background,
    },
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        alignItems: 'center',
        ...shadows.button,
    },
    saveButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    saveButtonText: {
        ...typography.body,
        color: colors.surface,
        fontWeight: '700',
    },
});

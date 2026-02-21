/**
 * Favorite Place Setup Screen
 * Add or edit a favorite location for quick access
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, Modal, Switch, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useFavoritePlaceStore, FavoriteSchedule } from '../src/stores/favoritePlaceStore';
import { useLocationPickerStore } from '../src/stores/locationPickerStore';
import { colors, typography, spacing, radius, shadows } from '../src/styles/theme';
import { useDistanceFormatter } from '../src/utils/distanceFormatter';

// Available icons for selection
const ICONS = [
    'home', 'business', 'cafe', 'school', 'fitness', 'cart',
    'airplane', 'restaurant', 'walk', 'people', 'heart', 'star',
    'location', 'flag', 'bookmark', 'pin',
];

export default function FavoritePlaceSetup() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        latitude: string;
        longitude: string;
        address?: string;
        radius?: string;
        editId?: string;
    }>();

    const { t } = useTranslation();
    const { addFavorite, updateFavorite, favorites } = useFavoritePlaceStore();
    const { pickedLocation, clearPickedLocation } = useLocationPickerStore();
    const { formatRadius } = useDistanceFormatter();

    // Find existing favorite if in edit mode
    const existingFavorite = params.editId
        ? favorites.find(f => f.id === params.editId)
        : null;

    // Location state (can be updated by location-picker)
    const [locationLat, setLocationLat] = useState<string>(
        params.latitude || (existingFavorite ? String(existingFavorite.latitude) : '')
    );
    const [locationLng, setLocationLng] = useState<string>(
        params.longitude || (existingFavorite ? String(existingFavorite.longitude) : '')
    );
    const [locationAddress, setLocationAddress] = useState<string>(
        params.address || ''
    );

    // Radius state (mutable — updated by location picker or edit mode)
    const [savedRadius, setSavedRadius] = useState(
        params.radius ? parseInt(params.radius) : (existingFavorite?.radius ?? 500)
    );

    // Pick up location from picker store when returning from location-picker
    useEffect(() => {
        if (pickedLocation) {
            setLocationLat(String(pickedLocation.latitude));
            setLocationLng(String(pickedLocation.longitude));
            setLocationAddress(pickedLocation.address);
            if (pickedLocation.radius) {
                setSavedRadius(pickedLocation.radius);
            }
            clearPickedLocation();
        }
    }, [pickedLocation, clearPickedLocation]);

    // Icon and basic info state
    const [label, setLabel] = useState(existingFavorite?.label ?? '');
    const [selectedIcon, setSelectedIcon] = useState(existingFavorite?.icon ?? 'home');
    const [showIconPicker, setShowIconPicker] = useState(false);

    // Schedule state
    const [scheduleEnabled, setScheduleEnabled] = useState(
        existingFavorite?.schedule?.enabled ?? false
    );
    const [selectedDays, setSelectedDays] = useState<number[]>(
        existingFavorite?.schedule?.days ?? [1, 2, 3, 4, 5]
    );
    const [startTime, setStartTime] = useState(
        existingFavorite?.schedule?.startTime ?? '07:00'
    );
    const [endTime, setEndTime] = useState(
        existingFavorite?.schedule?.endTime ?? '09:00'
    );
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);

    // Day labels for schedule
    const dayLabels = [
        t('days.sun'),
        t('days.mon'),
        t('days.tue'),
        t('days.wed'),
        t('days.thu'),
        t('days.fri'),
        t('days.sat'),
    ];

    // Toggle day selection
    const toggleDay = (day: number) => {
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Convert time string (HH:mm) to Date for time picker
    const timeStringToDate = (time: string): Date => {
        const [hours, minutes] = time.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    };

    // Handle time picker change
    const handleTimeChange = (type: 'start' | 'end', event: any, date?: Date) => {
        if (Platform.OS === 'android') {
            type === 'start' ? setShowStartTimePicker(false) : setShowEndTimePicker(false);
        }
        if (date) {
            const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            type === 'start' ? setStartTime(timeStr) : setEndTime(timeStr);
        }
    };

    // Navigate to location picker
    const handleLocationPress = () => {
        router.push('/location-picker');
    };

    const hasLocation = !!locationLat && !!locationLng;

    const handleSave = async () => {
        if (!label.trim()) {
            Alert.alert(t('favoriteSetup.noName'), t('favoriteSetup.pleaseEnterName'));
            return;
        }

        if (!hasLocation) {
            Alert.alert(t('common.error'), t('favoriteSetup.noLocation'));
            return;
        }

        // Skip max limit check in edit mode
        if (!params.editId && favorites.length >= 3) {
            Alert.alert(t('common.error'), t('favoriteSetup.maxLimitReached'));
            return;
        }

        const lat = parseFloat(locationLat);
        const lng = parseFloat(locationLng);

        if (isNaN(lat) || isNaN(lng)) {
            Alert.alert(t('common.error'), t('alarmSetup.locationError'));
            return;
        }

        const schedule: FavoriteSchedule | undefined = scheduleEnabled
            ? { enabled: true, days: selectedDays, startTime, endTime }
            : undefined;

        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            if (params.editId) {
                // Edit mode
                await updateFavorite(params.editId, {
                    label: label.trim(),
                    icon: selectedIcon,
                    latitude: lat,
                    longitude: lng,
                    radius: savedRadius,
                    schedule,
                });
            } else {
                // Add mode
                await addFavorite({
                    label: label.trim(),
                    icon: selectedIcon,
                    latitude: lat,
                    longitude: lng,
                    radius: savedRadius,
                    schedule,
                    isActive: true,
                });
            }

            router.back();
        } catch (error) {
            console.error('[FavoritePlaceSetup] Failed to save:', error);
            Alert.alert(t('common.error'), t('common.saveFailed'));
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    style={styles.closeButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="close" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>
                    {params.editId ? t('favoriteSetup.editTitle') : t('favoriteSetup.title')}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Name Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('favoriteSetup.nameLabel')}</Text>
                    <TextInput
                        style={styles.input}
                        value={label}
                        onChangeText={setLabel}
                        placeholder={t('favoriteSetup.namePlaceholder')}
                        placeholderTextColor={colors.textWeak}
                        autoFocus
                    />
                </View>

                {/* Icon Selection - Modal Picker */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('favoriteSetup.iconLabel')}</Text>
                    <Pressable
                        style={styles.iconSelector}
                        onPress={() => setShowIconPicker(true)}
                    >
                        <Ionicons name={selectedIcon as any} size={24} color={colors.primary} />
                        <Text style={styles.iconSelectorText}>{selectedIcon}</Text>
                        <Ionicons name="chevron-down" size={16} color={colors.textWeak} />
                    </Pressable>
                </View>

                {/* Schedule Section */}
                <View style={styles.section}>
                    <View style={styles.scheduleHeader}>
                        <Text style={styles.label}>{t('favoriteSetup.scheduleLabel')}</Text>
                        <Switch
                            value={scheduleEnabled}
                            onValueChange={setScheduleEnabled}
                            trackColor={{ false: colors.textMedium, true: colors.primary }}
                            ios_backgroundColor={colors.textMedium}
                        />
                    </View>

                    {scheduleEnabled && (
                        <View style={styles.scheduleContent}>
                            {/* Days Selection */}
                            <Text style={styles.scheduleSubLabel}>{t('favoriteSetup.daysLabel')}</Text>
                            <View style={styles.daysRow}>
                                {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                                    <Pressable
                                        key={day}
                                        style={[
                                            styles.dayChip,
                                            selectedDays.includes(day) && styles.dayChipSelected,
                                        ]}
                                        onPress={() => toggleDay(day)}
                                    >
                                        <Text
                                            style={[
                                                styles.dayChipText,
                                                selectedDays.includes(day) && styles.dayChipTextSelected,
                                            ]}
                                        >
                                            {dayLabels[day]}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Time Selection */}
                            <View style={styles.timeRow}>
                                <View style={styles.timeBlock}>
                                    <Text style={styles.scheduleSubLabel}>{t('favoriteSetup.startTime')}</Text>
                                    <Pressable
                                        style={styles.timeButton}
                                        onPress={() => setShowStartTimePicker(true)}
                                    >
                                        <Ionicons name="time-outline" size={18} color={colors.primary} />
                                        <Text style={styles.timeText}>{startTime}</Text>
                                    </Pressable>
                                </View>
                                <Text style={styles.timeSeparator}>~</Text>
                                <View style={styles.timeBlock}>
                                    <Text style={styles.scheduleSubLabel}>{t('favoriteSetup.endTime')}</Text>
                                    <Pressable
                                        style={styles.timeButton}
                                        onPress={() => setShowEndTimePicker(true)}
                                    >
                                        <Ionicons name="time-outline" size={18} color={colors.primary} />
                                        <Text style={styles.timeText}>{endTime}</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* Location Details (Tappable - opens location picker) */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('favoriteSetup.locationLabel')}</Text>
                    <Pressable style={styles.detailsCard} onPress={handleLocationPress}>
                        {hasLocation ? (
                            <>
                                <View style={styles.detailRow}>
                                    <Ionicons name="location-outline" size={20} color={colors.primary} />
                                    <Text style={styles.detailText} numberOfLines={1}>
                                        {locationAddress || `${locationLat}, ${locationLng}`}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={16} color={colors.textWeak} />
                                </View>
                                <View style={styles.detailRow}>
                                    <Ionicons name="radio-button-on-outline" size={20} color={colors.primary} />
                                    <Text style={styles.detailText}>
                                        {t('home.radius', { radius: formatRadius(savedRadius) })}
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <View style={styles.detailRow}>
                                <Ionicons name="map-outline" size={20} color={colors.primary} />
                                <Text style={[styles.detailText, { color: colors.primary }]}>
                                    {t('favoriteSetup.tapToSetLocation')}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                            </View>
                        )}
                    </Pressable>
                </View>
            </ScrollView>

            {/* Save Button */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
                <Pressable
                    style={({ pressed }) => [
                        styles.saveButton,
                        pressed && styles.saveButtonPressed,
                        (!label.trim() || !hasLocation) && styles.saveButtonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={!label.trim() || !hasLocation}
                >
                    <Text style={styles.saveButtonText}>{t('favoriteSetup.save')}</Text>
                </Pressable>
            </View>

            {/* Icon Picker Modal */}
            {showIconPicker && (
                <Modal transparent animationType="fade" visible={showIconPicker}>
                    <Pressable style={styles.modalOverlay} onPress={() => setShowIconPicker(false)}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>{t('favoriteSetup.iconLabel')}</Text>
                            <View style={styles.iconGrid}>
                                {ICONS.map((icon) => (
                                    <Pressable
                                        key={icon}
                                        style={[
                                            styles.iconOption,
                                            selectedIcon === icon && styles.iconOptionSelected,
                                        ]}
                                        onPress={() => {
                                            setSelectedIcon(icon);
                                            setShowIconPicker(false);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                    >
                                        <Ionicons
                                            name={icon as any}
                                            size={24}
                                            color={selectedIcon === icon ? colors.primary : colors.textMedium}
                                        />
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    </Pressable>
                </Modal>
            )}

            {/* Time Pickers */}
            {showStartTimePicker && (
                <DateTimePicker
                    value={timeStringToDate(startTime)}
                    mode="time"
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e: any, d?: Date) => handleTimeChange('start', e, d)}
                />
            )}
            {showEndTimePicker && (
                <DateTimePicker
                    value={timeStringToDate(endTime)}
                    mode="time"
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e: any, d?: Date) => handleTimeChange('end', e, d)}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
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
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    iconOption: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '22%',
        paddingVertical: spacing.xs,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    iconOptionSelected: {
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}10`,
    },
    iconLabel: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 4,
    },
    iconLabelSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    iconSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
    },
    iconSelectorText: {
        ...typography.body,
        color: colors.textStrong,
        flex: 1,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        ...typography.body,
        color: colors.textStrong,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
    },
    infoText: {
        ...typography.body,
        color: colors.textMedium,
        flex: 1,
    },
    footer: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.background,
    },
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        ...shadows.button,
    },
    saveButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    saveButtonDisabled: {
        backgroundColor: colors.textWeak,
        opacity: 0.5,
    },
    saveButtonText: {
        ...typography.body,
        color: colors.surface,
        fontWeight: '600',
    },
    closeButton: {
        padding: spacing.xs,
        marginLeft: -spacing.xs,
    },
    detailsCard: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.background,
        gap: spacing.sm,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    detailText: {
        ...typography.body,
        color: colors.textMedium,
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        width: '80%',
    },
    modalTitle: {
        ...typography.heading,
        color: colors.textStrong,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    scheduleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    scheduleContent: {
        marginTop: spacing.sm,
        gap: spacing.sm,
    },
    scheduleSubLabel: {
        ...typography.caption,
        color: colors.textMedium,
        fontWeight: '600',
        marginBottom: 4,
    },
    daysRow: {
        flexDirection: 'row',
        gap: 6,
    },
    dayChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: radius.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.background,
    },
    dayChipSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dayChipText: {
        ...typography.caption,
        color: colors.textMedium,
        fontWeight: '600',
    },
    dayChipTextSelected: {
        color: '#FFFFFF',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
    },
    timeBlock: {
        flex: 1,
    },
    timeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: colors.background,
    },
    timeText: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
    },
    timeSeparator: {
        ...typography.body,
        color: colors.textWeak,
        paddingBottom: spacing.sm,
    },
});

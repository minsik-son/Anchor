/**
 * LocaAlert Alarm Setup Screen
 * Quick setup with icon selection and toggle options
 */

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useLocationStore } from '../src/stores/locationStore';
import { startBackgroundLocation } from '../src/services/location/locationService';
import { useTranslation } from 'react-i18next';
import { typography, spacing, radius, shadows, alarmDefaults, useThemeColors, ThemeColors } from '../src/styles/theme';

const ALARM_ICONS = [
    { key: 'home', icon: 'home' },
    { key: 'office', icon: 'business' },
    { key: 'restaurant', icon: 'restaurant' },
    { key: 'cafe', icon: 'cafe' },
    { key: 'pin', icon: 'location' },
    { key: 'gym', icon: 'fitness' },
    { key: 'others', icon: 'ellipsis-horizontal' },
] as const;

export default function AlarmSetup() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        latitude: string;
        longitude: string;
        radius: string;
        address?: string;
        locationName?: string;
    }>();

    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [title, setTitle] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('pin');
    const [alarmRadius, setAlarmRadius] = useState(
        params.radius ? parseInt(params.radius) : alarmDefaults.radius
    );
    const [memo, setMemo] = useState('');
    const [smartBattery, setSmartBattery] = useState(true);
    const [shakeToDismiss, setShakeToDismiss] = useState(false);

    const { createAlarm, addMemo } = useAlarmStore();
    const { startTracking, checkGeofence } = useLocationStore();

    const handleAutoFillTitle = () => {
        const addressName = params.locationName || params.address || '';
        if (addressName) {
            setTitle(addressName);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handleIconSelect = (iconKey: string) => {
        setSelectedIcon(iconKey);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTitle(t(`alarmSetup.icons.${iconKey}`));
    };

    const handleCreateAlarm = async () => {
        if (!title.trim()) {
            Alert.alert(t('alarmSetup.noTitle'), t('alarmSetup.pleaseEnterTitle'));
            return;
        }

        if (!params.latitude || !params.longitude) {
            Alert.alert(t('common.error'), t('alarmSetup.locationError'));
            return;
        }

        const lat = parseFloat(params.latitude);
        const lng = parseFloat(params.longitude);

        console.log('[AlarmSetup] Alarm data:', {
            title,
            icon: selectedIcon,
            radius: alarmRadius,
            memo,
            smartBattery,
            shakeToDismiss,
            latitude: lat,
            longitude: lng,
            address: params.address,
        });

        try {
            const alarmId = await createAlarm({
                title,
                latitude: lat,
                longitude: lng,
                radius: alarmRadius,
            });

            // Parse memo into checklist items (split by comma, filter empty)
            if (memo.trim()) {
                const items = memo.split(',').map(s => s.trim()).filter(Boolean);
                for (const item of items) {
                    await addMemo({
                        alarm_id: alarmId,
                        type: 'CHECKLIST',
                        content: item,
                    });
                }
            }

            // Start location tracking
            const target = { latitude: lat, longitude: lng };
            await startTracking(target, alarmRadius);

            // Start background location (may fail in Expo Go)
            try {
                await startBackgroundLocation(target, alarmRadius);
            } catch (bgError) {
                console.warn('[AlarmSetup] Background location failed (Expo Go?):', bgError);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Immediate geofence check: if user is already inside radius, trigger alarm now
            if (checkGeofence()) {
                console.log('[AlarmSetup] User already inside radius — triggering alarm immediately');
                router.replace('/alarm-trigger');
            } else {
                router.replace('/(tabs)/home');
            }
        } catch (error) {
            Alert.alert(t('common.error'), t('alarmSetup.createFailed'));
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Ionicons name="close" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('alarmSetup.title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Title Input with Auto-fill Button */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('alarmSetup.titleLabel')}</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={[styles.input, styles.inputWithButton]}
                            value={title}
                            onChangeText={setTitle}
                            placeholder={t('alarmSetup.titlePlaceholder')}
                            placeholderTextColor={colors.textWeak}
                            autoFocus
                        />
                        <Pressable
                            style={styles.autoFillButton}
                            onPress={handleAutoFillTitle}
                        >
                            <Ionicons name="sparkles" size={20} color={colors.primary} />
                        </Pressable>
                    </View>
                </View>

                {/* Icon Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('alarmSetup.iconLabel')}</Text>
                    <View style={styles.iconGrid}>
                        {ALARM_ICONS.map((item) => (
                            <Pressable
                                key={item.key}
                                style={[
                                    styles.iconOption,
                                    selectedIcon === item.key && styles.iconOptionSelected,
                                ]}
                                onPress={() => handleIconSelect(item.key)}
                            >
                                <Ionicons
                                    name={item.icon as any}
                                    size={24}
                                    color={selectedIcon === item.key ? colors.primary : colors.textMedium}
                                />
                                <Text style={[
                                    styles.iconLabel,
                                    selectedIcon === item.key && styles.iconLabelSelected,
                                ]}>
                                    {t(`alarmSetup.icons.${item.key}`)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Location Info with Debug Red Dot */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('alarmSetup.locationLabel')}</Text>
                    <View style={styles.locationCard}>
                        <View style={styles.locationRow}>
                            <Ionicons name="location" size={20} color={colors.primary} />
                            <Text style={styles.locationAddress} numberOfLines={1}>
                                {params.address || `${params.latitude}, ${params.longitude}`}
                            </Text>
                        </View>
                        <View style={styles.locationRow}>
                            <View style={styles.redDot} />
                            <Text style={styles.locationCoords}>
                                {t('alarmSetup.rawCoordinates')}: {params.latitude}, {params.longitude}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Alarm Radius */}
                <View style={styles.section}>
                    <View style={styles.row}>
                        <Text style={styles.label}>{t('alarmSetup.radius')}</Text>
                        <Text style={styles.radiusValue}>{t('alarmSetup.radiusValue', { radius: alarmRadius })}</Text>
                    </View>
                    <Slider
                        style={styles.slider}
                        minimumValue={100}
                        maximumValue={2000}
                        step={100}
                        value={alarmRadius}
                        onValueChange={setAlarmRadius}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={colors.background}
                    />
                </View>

                {/* Memo */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('alarmSetup.memo')}</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={memo}
                        onChangeText={setMemo}
                        placeholder={t('alarmSetup.memoPlaceholder')}
                        placeholderTextColor={colors.textWeak}
                        multiline
                    />
                </View>

                {/* Toggle Options */}
                <View style={styles.toggleSection}>
                    {/* Smart Battery Saving */}
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleLeft}>
                            <Ionicons name="battery-charging" size={22} color={colors.primary} />
                            <View style={styles.toggleContent}>
                                <Text style={styles.toggleTitle}>{t('alarmSetup.smartBattery')}</Text>
                                <Text style={styles.toggleDesc}>{t('alarmSetup.smartBatteryDesc')}</Text>
                            </View>
                        </View>
                        <Switch
                            value={smartBattery}
                            onValueChange={setSmartBattery}
                            trackColor={{ false: colors.textWeak, true: colors.primary }}
                        />
                    </View>

                    {/* Shake to Dismiss */}
                    <View style={[styles.toggleRow, styles.toggleRowLast]}>
                        <View style={styles.toggleLeft}>
                            <Ionicons name="phone-portrait" size={22} color={colors.primary} />
                            <View style={styles.toggleContent}>
                                <Text style={styles.toggleTitle}>{t('alarmSetup.shakeToDismiss')}</Text>
                                <Text style={styles.toggleDesc}>{t('alarmSetup.shakeToDismissDesc')}</Text>
                            </View>
                        </View>
                        <Switch
                            value={shakeToDismiss}
                            onValueChange={setShakeToDismiss}
                            trackColor={{ false: colors.textWeak, true: colors.primary }}
                        />
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    style={({ pressed }) => [
                        styles.createButton,
                        pressed && styles.createButtonPressed,
                    ]}
                    onPress={handleCreateAlarm}
                >
                    <Text style={styles.createButtonText}>{t('alarmSetup.startAlarm')}</Text>
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    radiusValue: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '700',
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        ...typography.body,
        color: colors.textStrong,
    },
    inputRow: {
        flexDirection: 'row',
        gap: spacing.xs,
        alignItems: 'center',
    },
    inputWithButton: {
        flex: 1,
    },
    autoFillButton: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.button,
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
    // Location Debug
    locationCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        gap: spacing.xs,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    locationAddress: {
        ...typography.body,
        color: colors.textStrong,
        flex: 1,
    },
    locationCoords: {
        ...typography.caption,
        color: colors.textWeak,
        flex: 1,
    },
    redDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F04452',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    // Toggle Section
    toggleSection: {
        marginBottom: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        overflow: 'hidden',
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.background,
    },
    toggleRowLast: {
        borderBottomWidth: 0,
    },
    toggleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
        marginRight: spacing.xs,
    },
    toggleContent: {
        flex: 1,
    },
    toggleTitle: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
    },
    toggleDesc: {
        ...typography.caption,
        color: colors.textWeak,
        marginTop: 2,
    },
    footer: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.lg,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.background,
    },
    createButton: {
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        alignItems: 'center',
        ...shadows.button,
    },
    createButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    createButtonText: {
        ...typography.body,
        color: colors.surface,
        fontWeight: '700',
    },
});

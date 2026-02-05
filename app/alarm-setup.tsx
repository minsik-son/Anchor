/**
 * LocaAlert Alarm Setup Screen
 * Detailed alarm configuration with navigation settings
 */

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useLocationStore, TransportMode, RouteInfo } from '../src/stores/locationStore';
import { useTranslation } from 'react-i18next';
import { colors as defaultColors, typography, spacing, radius, shadows, alarmDefaults, useThemeColors, ThemeColors } from '../src/styles/theme';

// Mock route data
const MOCK_ROUTES: RouteInfo[] = [
    {
        id: '1',
        name: '추천 경로',
        duration: 25,
        distance: 8500,
        eta: '14:25',
        coordinates: [
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.5600, longitude: 126.9850 },
            { latitude: 37.5550, longitude: 126.9900 },
        ],
    },
    {
        id: '2',
        name: '최단 시간',
        duration: 22,
        distance: 9200,
        eta: '14:22',
        coordinates: [
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.5700, longitude: 126.9900 },
            { latitude: 37.5550, longitude: 126.9900 },
        ],
    },
    {
        id: '3',
        name: '최단 거리',
        duration: 28,
        distance: 7800,
        eta: '14:28',
        coordinates: [
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.5580, longitude: 126.9820 },
            { latitude: 37.5550, longitude: 126.9900 },
        ],
    },
];

// Moved inside component or translated dynamically
const getTransportModes = (t: any) => [
    { mode: 'driving', icon: 'car', label: t('alarmSetup.driving') },
    { mode: 'transit', icon: 'bus', label: t('alarmSetup.transit') },
    { mode: 'walking', icon: 'walk', label: t('alarmSetup.walking') },
    { mode: 'cycling', icon: 'bicycle', label: t('alarmSetup.cycling') },
];

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

    // Mock route data with translations
    const routes = useMemo<RouteInfo[]>(() => [
        {
            id: '1',
            name: t('routes.recommended'),
            duration: 25,
            distance: 8500,
            eta: '14:25',
            coordinates: [
                { latitude: 37.5665, longitude: 126.9780 },
                { latitude: 37.5600, longitude: 126.9850 },
                { latitude: 37.5550, longitude: 126.9900 },
            ],
        },
        {
            id: '2',
            name: t('routes.shortest'),
            duration: 22,
            distance: 9200,
            eta: '14:22',
            coordinates: [
                { latitude: 37.5665, longitude: 126.9780 },
                { latitude: 37.5700, longitude: 126.9900 },
                { latitude: 37.5550, longitude: 126.9900 },
            ],
        },
        {
            id: '3',
            name: t('routes.shortestDistance'),
            duration: 28,
            distance: 7800,
            eta: '14:28',
            coordinates: [
                { latitude: 37.5665, longitude: 126.9780 },
                { latitude: 37.5580, longitude: 126.9820 },
                { latitude: 37.5550, longitude: 126.9900 },
            ],
        },
    ], [t]);

    const transportModes = useMemo(() => getTransportModes(t), [t]);
    const [title, setTitle] = useState('');
    const [alarmRadius, setAlarmRadius] = useState(
        params.radius ? parseInt(params.radius) : alarmDefaults.radius
    );
    const [memo, setMemo] = useState('');
    const [startLocationType, setStartLocationType] = useState<'current' | 'custom'>('current');
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>('1');

    const { createAlarm } = useAlarmStore();
    const {
        startTracking,
        transportMode,
        setTransportMode,
        setRoutes,
        selectRoute,
        startNavigation
    } = useLocationStore();

    // Calculate alarm preview text
    const alarmPreview = useMemo(() => {
        const selectedRoute = routes.find(r => r.id === selectedRouteId);
        if (!selectedRoute) return null;

        // Calculate time to reach alarm radius
        const avgSpeed = transportMode === 'driving' ? 40 :
            transportMode === 'transit' ? 30 :
                transportMode === 'walking' ? 5 : 15; // km/h
        const distanceToAlarm = selectedRoute.distance - alarmRadius;
        const minutesToAlarm = Math.round((distanceToAlarm / 1000) / avgSpeed * 60);

        return {
            text: `목적지 반경 ${alarmRadius}m 전`,
            alarmTime: minutesToAlarm,
        };
    }, [selectedRouteId, alarmRadius, transportMode]);

    const handleCreateAlarm = async () => {
        if (!title.trim()) {
            Alert.alert(t('alarmSetup.noTitle'), t('alarmSetup.pleaseEnterTitle'));
            return;
        }

        if (!params.latitude || !params.longitude) {
            Alert.alert(t('common.error'), t('alarmSetup.locationError'));
            return;
        }

        const alarm = {
            id: Date.now().toString(),
            title,
            latitude: parseFloat(params.latitude),
            longitude: parseFloat(params.longitude),
            radius: alarmRadius,
            isActive: true,
            address: params.address || `${params.latitude}, ${params.longitude}`, // Use raw coordinates if address missing
            created_at: new Date().toISOString(),
        };

        try {
            await createAlarm(alarm);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/(tabs)/history');
        } catch (error) {
            Alert.alert(t('common.error'), t('alarmSetup.createFailed'));
        }
    };

    const formatDistance = (meters: number) => {
        if (meters >= 1000) {
            return `${(meters / 1000).toFixed(1)}km`;
        }
        return `${meters}m`;
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
                {/* Title Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('alarmSetup.titleLabel')}</Text>
                    <TextInput
                        style={styles.input}
                        value={title}
                        onChangeText={setTitle}
                        placeholder={t('alarmSetup.titlePlaceholder')}
                        placeholderTextColor={colors.textWeak}
                        autoFocus
                    />
                </View>

                {/* Location Info */}
                <View style={styles.section}>
                    <View style={styles.row}>
                        <View style={styles.locationItem}>
                            <Text style={styles.locationLabel}>{t('alarmSetup.startLocation')}</Text>
                            <View style={styles.locationValue}>
                                <View style={[styles.dot, { backgroundColor: colors.textMedium }]} />
                                <Text style={styles.locationText}>{t('alarmSetup.currentLocation')}</Text>
                            </View>
                        </View>
                        <Ionicons name="arrow-forward" size={20} color={colors.textWeak} />
                        <View style={styles.locationItem}>
                            <Text style={styles.locationLabel}>{params.locationName || t('alarmSetup.selectFromMap')}</Text>
                            <View style={styles.locationValue}>
                                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                                <Text style={styles.locationText} numberOfLines={1}>
                                    {params.address || `${params.latitude}, ${params.longitude}`}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Transport Mode */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('alarmSetup.transportMode')}</Text>
                    <View style={styles.transportGrid}>
                        {transportModes.map((item) => (
                            <Pressable
                                key={item.mode}
                                style={[
                                    styles.transportItem,
                                    transportMode === item.mode && styles.transportItemSelected,
                                ]}
                                onPress={() => setTransportMode(item.mode as any)}
                            >
                                <Ionicons
                                    name={item.icon as any}
                                    size={24}
                                    color={transportMode === item.mode ? colors.primary : colors.textWeak}
                                />
                                <Text
                                    style={[
                                        styles.transportLabel,
                                        transportMode === item.mode && styles.transportLabelSelected,
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Route Options */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('alarmSetup.routeOptions')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.routeList}>
                        {routes.map((route) => (
                            <Pressable
                                key={route.id}
                                style={[
                                    styles.routeCard,
                                    selectedRouteId === route.id && styles.routeCardSelected,
                                ]}
                                onPress={() => setSelectedRouteId(route.id)}
                            >
                                <View style={styles.routeHeader}>
                                    <Text
                                        style={[
                                            styles.routeName,
                                            selectedRouteId === route.id && styles.routeNameSelected,
                                        ]}
                                    >
                                        {route.name}
                                    </Text>
                                </View>
                                <View style={styles.routeInfo}>
                                    <View style={styles.routeInfoItem}>
                                        <Ionicons name="time-outline" size={14} color={colors.textWeak} />
                                        <Text style={styles.routeInfoText}>{route.duration}분</Text>
                                    </View>
                                    <View style={styles.routeInfoItem}>
                                        <Ionicons name="navigate-outline" size={14} color={colors.textWeak} />
                                        <Text style={styles.routeInfoText}>{formatDistance(route.distance)}</Text>
                                    </View>
                                </View>
                                <Text
                                    style={[
                                        styles.routeEta,
                                        selectedRouteId === route.id && styles.routeEtaSelected,
                                    ]}
                                >
                                    {t('routes.arrival', { time: route.eta })}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
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

                {/* Alarm Preview */}
                {alarmPreview && (
                    <View style={styles.previewCard}>
                        <View style={styles.previewHeader}>
                            <Ionicons name="notifications" size={20} color={colors.primary} />
                            <Text style={styles.previewTitle}>
                                {t('alarmSetup.alarmPreview.beforeRadius', { radius: alarmRadius })}
                            </Text>
                        </View>
                        <Text style={styles.previewText}>
                            {t('alarmSetup.alarmPreview.estimatedTime', { minutes: alarmPreview.alarmTime })}
                        </Text>
                    </View>
                )}

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
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
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
    // Start Location Styles
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    locationItem: {
        flex: 1,
        gap: 6,
    },
    locationLabel: {
        ...typography.caption,
        color: colors.textMedium,
    },
    locationValue: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.background,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    locationText: {
        ...typography.body,
        color: colors.textStrong,
        flex: 1,
    },
    // Transport Mode Styles
    transportGrid: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    transportItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    transportItemSelected: {
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}08`,
    },
    transportLabel: {
        ...typography.caption,
        color: colors.textMedium,
    },
    transportLabelSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    // Route Card Styles
    routeList: {
        marginHorizontal: -spacing.md,
        paddingHorizontal: spacing.md,
    },
    routeCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        marginRight: spacing.sm,
        width: 140,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    routeCardSelected: {
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}08`,
    },
    routeHeader: {
        marginBottom: spacing.sm,
    },
    routeName: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
    },
    routeNameSelected: {
        color: colors.primary,
    },
    routeEta: {
        ...typography.caption,
        color: colors.textMedium,
    },
    routeEtaSelected: {
        color: colors.primary,
        fontWeight: '500',
    },
    routeInfo: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: 4,
    },
    routeInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    routeInfoText: {
        ...typography.caption,
        color: colors.textWeak,
        fontSize: 11,
    },
    // Alarm Preview Styles
    previewCard: {
        backgroundColor: `${colors.primary}10`,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: 4,
    },
    previewTitle: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '600',
    },
    previewText: {
        ...typography.caption,
        color: colors.textMedium,
        marginLeft: 26,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    slider: {
        width: '100%',
        height: 40,
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

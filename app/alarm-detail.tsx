/**
 * LocaAlert Alarm Detail Screen
 * Full detail view with mini-map, travel info, checklist, and status
 */

import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform, useColorScheme } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE, Marker, Circle, Polyline } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Alarm, ActionMemo } from '../src/db/schema';
import * as db from '../src/db/database';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useThemeStore } from '../src/stores/themeStore';
import { reverseGeocode } from '../src/services/geocoding';
import { calculateDistance } from '../src/services/location/geofence';
import { useDistanceFormatter } from '../src/utils/distanceFormatter';
import { mapDarkStyle } from '../src/constants/mapDarkStyle';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';

type StatusType = 'active' | 'arrived' | 'cancelled';

interface ParsedRoutePoint {
    latitude: number;
    longitude: number;
    timestamp: number;
}

function getAlarmStatus(alarm: Alarm): StatusType {
    if (alarm.is_active) return 'active';
    if (alarm.arrived_at) return 'arrived';
    return 'cancelled';
}

function parseRoutePoints(json: string | null): ParsedRoutePoint[] {
    if (!json) return [];
    try {
        return JSON.parse(json);
    } catch {
        return [];
    }
}

export default function AlarmDetail() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ alarmId: string }>();
    const { t, i18n } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const themeMode = useThemeStore((state) => state.mode);
    const systemScheme = useColorScheme();
    const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');

    const { deleteAlarm, loadAlarms } = useAlarmStore();
    const { formatDistance } = useDistanceFormatter();

    const [alarm, setAlarm] = useState<Alarm | null>(null);
    const [memos, setMemos] = useState<ActionMemo[]>([]);
    const [destAddress, setDestAddress] = useState('');
    const [startAddress, setStartAddress] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!params.alarmId) return;

            const alarmId = parseInt(params.alarmId);
            if (isNaN(alarmId)) {
                router.back();
                return;
            }
            const alarmData = await db.getAlarmById(alarmId);
            if (!alarmData) {
                router.back();
                return;
            }
            setAlarm(alarmData);

            const memosData = await db.getActionMemosByAlarmId(alarmId);
            setMemos(memosData);

            // Reverse geocode destination
            const destResult = await reverseGeocode(alarmData.latitude, alarmData.longitude);
            setDestAddress(destResult.address || t('history.detail.addressNotFound'));

            // Reverse geocode start location if available
            if (alarmData.start_latitude && alarmData.start_longitude) {
                const startResult = await reverseGeocode(alarmData.start_latitude, alarmData.start_longitude);
                setStartAddress(startResult.address || t('history.detail.addressNotFound'));
            }

            setIsLoading(false);
        };
        load();
    }, [params.alarmId]);

    const status = alarm ? getAlarmStatus(alarm) : 'cancelled';

    const travelDuration = useMemo(() => {
        if (!alarm?.started_at || !alarm?.arrived_at) return null;
        const diffMs = new Date(alarm.arrived_at).getTime() - new Date(alarm.started_at).getTime();
        const totalMinutes = Math.round(diffMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours > 0 && minutes > 0) {
            return t('alarmDetail.durationHoursMinutes', { hours, minutes });
        }
        if (hours > 0) {
            return t('alarmDetail.durationHours', { hours });
        }
        return t('alarmDetail.durationMinutes', { minutes: totalMinutes });
    }, [alarm, t]);

    const routePoints = useMemo(() => {
        return alarm ? parseRoutePoints(alarm.route_points) : [];
    }, [alarm]);

    // Straight-line distance (start → destination) — always shown in Location Info
    const straightDistance = useMemo(() => {
        if (!alarm?.start_latitude || !alarm?.start_longitude) return null;
        const meters = calculateDistance(
            { latitude: alarm.start_latitude, longitude: alarm.start_longitude },
            { latitude: alarm.latitude, longitude: alarm.longitude }
        );
        return formatDistance(meters);
    }, [alarm, formatDistance]);

    // Actual traveled distance — show 0 when no distance recorded
    const actualTraveledDistance = useMemo(() => {
        if (!alarm) return null;
        // Only show for completed or cancelled alarms (not active ones)
        if (alarm.is_active) return null;
        const distance = alarm.traveled_distance ?? 0;
        return formatDistance(distance);
    }, [alarm, formatDistance]);

    const mapRegion = useMemo(() => {
        if (!alarm) return undefined;

        // Collect all coordinates (route points + start + destination) for bounding
        const allCoords: { latitude: number; longitude: number }[] = [
            { latitude: alarm.latitude, longitude: alarm.longitude },
        ];
        if (alarm.start_latitude && alarm.start_longitude) {
            allCoords.push({ latitude: alarm.start_latitude, longitude: alarm.start_longitude });
        }
        if (routePoints.length > 0) {
            routePoints.forEach(p => allCoords.push({ latitude: p.latitude, longitude: p.longitude }));
        }

        if (allCoords.length > 1) {
            const lats = allCoords.map(c => c.latitude);
            const lngs = allCoords.map(c => c.longitude);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            const latDelta = (maxLat - minLat) * 1.5 + 0.01;
            const lngDelta = (maxLng - minLng) * 1.5 + 0.01;
            return {
                latitude: (minLat + maxLat) / 2,
                longitude: (minLng + maxLng) / 2,
                latitudeDelta: Math.max(latDelta, 0.01),
                longitudeDelta: Math.max(lngDelta, 0.01),
            };
        }

        return {
            latitude: alarm.latitude,
            longitude: alarm.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        };
    }, [alarm, routePoints]);

    const handleDelete = () => {
        if (!alarm) return;
        Alert.alert(
            t('history.detail.deleteAlarm'),
            '',
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        await deleteAlarm(alarm.id);
                        await loadAlarms();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        router.back();
                    },
                },
            ]
        );
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(i18n.language, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const statusConfig = {
        active: { label: t('alarmDetail.active'), color: colors.primary },
        arrived: { label: t('alarmDetail.arrived'), color: colors.success },
        cancelled: { label: t('alarmDetail.cancelled'), color: colors.textWeak },
    };

    if (isLoading || !alarm) return null;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('history.detail.title')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Mini Map */}
                <View style={styles.mapContainer}>
                    <MapView
                        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                        style={styles.map}
                        region={mapRegion}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        rotateEnabled={false}
                        pitchEnabled={false}
                        customMapStyle={isDarkMode ? mapDarkStyle : undefined}
                        userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
                    >
                        {/* Destination marker */}
                        <Marker
                            coordinate={{ latitude: alarm.latitude, longitude: alarm.longitude }}
                            pinColor={colors.error}
                        />
                        <Circle
                            center={{ latitude: alarm.latitude, longitude: alarm.longitude }}
                            radius={alarm.radius}
                            strokeColor={colors.primary}
                            strokeWidth={2}
                            fillColor={`${colors.primary}20`}
                        />

                        {/* Start location marker */}
                        {alarm.start_latitude && alarm.start_longitude && (
                            <Marker
                                coordinate={{ latitude: alarm.start_latitude, longitude: alarm.start_longitude }}
                                anchor={{ x: 0.5, y: 0.5 }}
                                tracksViewChanges={false}
                            >
                                <View style={styles.startMarker}>
                                    <View style={styles.startMarkerInner} />
                                </View>
                            </Marker>
                        )}

                        {/* Route polyline (actual path) or fallback dashed line */}
                        {routePoints.length > 1 ? (
                            <Polyline
                                coordinates={routePoints.map(p => ({
                                    latitude: p.latitude,
                                    longitude: p.longitude,
                                }))}
                                strokeColor="rgba(0, 200, 83, 0.8)"
                                strokeWidth={3}
                                lineJoin="round"
                                lineCap="round"
                            />
                        ) : alarm.start_latitude && alarm.start_longitude ? (
                            <Polyline
                                coordinates={[
                                    { latitude: alarm.start_latitude, longitude: alarm.start_longitude },
                                    { latitude: alarm.latitude, longitude: alarm.longitude },
                                ]}
                                strokeColor={colors.primary}
                                strokeWidth={2}
                                lineDashPattern={[8, 6]}
                            />
                        ) : null}
                    </MapView>
                </View>

                {/* Title + Status */}
                <View style={styles.titleSection}>
                    <Text style={styles.alarmTitle}>{alarm.title}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig[status].color }]}>
                        <Text style={styles.statusBadgeText}>{statusConfig[status].label}</Text>
                    </View>
                </View>

                {/* Location Info */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>{t('history.detail.locationInfo')}</Text>

                    {alarm.start_latitude && alarm.start_longitude ? (
                        <View style={styles.cardRow}>
                            <Ionicons name="ellipse" size={20} color={colors.primary} />
                            <View style={styles.cardRowContent}>
                                <Text style={styles.cardRowLabel}>{t('alarmDetail.startPoint')}</Text>
                                <Text style={styles.cardRowValue}>{startAddress}</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.cardRow}>
                            <Ionicons name="ellipse-outline" size={20} color={colors.textWeak} />
                            <View style={styles.cardRowContent}>
                                <Text style={styles.cardRowLabel}>{t('alarmDetail.startPoint')}</Text>
                                <Text style={[styles.cardRowValue, { color: colors.textWeak }]}>
                                    {t('alarmDetail.noStartLocation')}
                                </Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.cardRow}>
                        <Ionicons name="location" size={20} color={colors.error} />
                        <View style={styles.cardRowContent}>
                            <Text style={styles.cardRowLabel}>{t('alarmDetail.destination')}</Text>
                            <Text style={styles.cardRowValue}>{destAddress}</Text>
                        </View>
                    </View>

                    {straightDistance && (
                        <View style={styles.cardRow}>
                            <Ionicons name="resize-outline" size={20} color={colors.primary} />
                            <View style={styles.cardRowContent}>
                                <Text style={styles.cardRowLabel}>{t('alarmDetail.straightDistance')}</Text>
                                <Text style={styles.cardRowValue}>{straightDistance}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Travel & Time Info */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>{t('alarmDetail.travelInfo')}</Text>

                    <View style={styles.cardRow}>
                        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                        <View style={styles.cardRowContent}>
                            <Text style={styles.cardRowLabel}>{t('history.detail.createdAt')}</Text>
                            <Text style={styles.cardRowValue}>{formatDate(alarm.created_at)}</Text>
                        </View>
                    </View>

                    {travelDuration && (
                        <View style={styles.cardRow}>
                            <Ionicons name="time-outline" size={20} color={colors.primary} />
                            <View style={styles.cardRowContent}>
                                <Text style={styles.cardRowLabel}>{t('alarmDetail.travelTime')}</Text>
                                <Text style={styles.cardRowValue}>{travelDuration}</Text>
                            </View>
                        </View>
                    )}

                    {actualTraveledDistance && (
                        <View style={styles.cardRow}>
                            <Ionicons name="navigate-outline" size={20} color={colors.primary} />
                            <View style={styles.cardRowContent}>
                                <Text style={styles.cardRowLabel}>{t('alarmDetail.actualDistance')}</Text>
                                <Text style={styles.cardRowValue}>{actualTraveledDistance}</Text>
                            </View>
                        </View>
                    )}

                    {alarm.started_at && (
                        <View style={styles.cardRow}>
                            <Ionicons name="play-outline" size={20} color={colors.primary} />
                            <View style={styles.cardRowContent}>
                                <Text style={styles.cardRowLabel}>{t('alarmDetail.startedAt')}</Text>
                                <Text style={styles.cardRowValue}>{formatDate(alarm.started_at)}</Text>
                            </View>
                        </View>
                    )}

                    {alarm.arrived_at && (
                        <View style={styles.cardRow}>
                            <Ionicons name="flag-outline" size={20} color={colors.success} />
                            <View style={styles.cardRowContent}>
                                <Text style={styles.cardRowLabel}>{t('alarmDetail.arrivedAt')}</Text>
                                <Text style={styles.cardRowValue}>{formatDate(alarm.arrived_at)}</Text>
                            </View>
                        </View>
                    )}

                    {alarm.cancelled_at && !alarm.arrived_at && (
                        <View style={styles.cardRow}>
                            <Ionicons name="close-circle-outline" size={20} color={colors.textWeak} />
                            <View style={styles.cardRowContent}>
                                <Text style={styles.cardRowLabel}>{t('alarmDetail.cancelledAt')}</Text>
                                <Text style={styles.cardRowValue}>{formatDate(alarm.cancelled_at)}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Checklist */}
                {memos.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>{t('alarmDetail.checklist')}</Text>
                        {memos.map((memo) => (
                            <View key={memo.id} style={styles.checklistItem}>
                                <Ionicons
                                    name={memo.is_checked ? 'checkbox' : 'square-outline'}
                                    size={20}
                                    color={memo.is_checked ? colors.primary : colors.textWeak}
                                />
                                <Text style={[
                                    styles.checklistText,
                                    memo.is_checked && styles.checklistTextDone,
                                ]}>
                                    {memo.content}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Delete Button */}
                <Pressable style={styles.deleteButton} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={20} color={colors.surface} />
                    <Text style={styles.deleteButtonText}>{t('history.detail.deleteAlarm')}</Text>
                </Pressable>

                <View style={{ height: insets.bottom + spacing.lg }} />
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
    content: {
        flex: 1,
    },
    mapContainer: {
        height: 200,
        overflow: 'hidden',
    },
    map: {
        flex: 1,
    },
    startMarker: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: `${colors.primary}40`,
        justifyContent: 'center',
        alignItems: 'center',
    },
    startMarkerInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    titleSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    alarmTitle: {
        ...typography.heading,
        color: colors.textStrong,
        fontSize: 20,
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.sm,
        marginLeft: spacing.sm,
    },
    statusBadgeText: {
        ...typography.caption,
        color: colors.surface,
        fontWeight: '700',
    },
    card: {
        backgroundColor: colors.surface,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: radius.md,
        padding: spacing.sm,
        gap: spacing.xs,
        ...shadows.card,
    },
    cardLabel: {
        ...typography.caption,
        color: colors.textWeak,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    cardRowContent: {
        flex: 1,
    },
    cardRowLabel: {
        ...typography.caption,
        color: colors.textWeak,
    },
    cardRowValue: {
        ...typography.body,
        color: colors.textStrong,
    },
    checklistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: 4,
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
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.error,
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
    },
    deleteButtonText: {
        ...typography.body,
        color: colors.surface,
        fontWeight: '600',
    },
});

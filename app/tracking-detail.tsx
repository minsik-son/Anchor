/**
 * Tracking Detail - Full-screen tracking view with map and statistics
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Platform,
    useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useLocationStore } from '../src/stores/locationStore';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useThemeColors, spacing, radius, shadows, typography } from '../src/styles/theme';
import { useThemeStore } from '../src/stores/themeStore';
import { formatDistance } from '../src/services/location/geofence';
import { useElapsedTime } from '../src/hooks/useElapsedTime';
import { mapDarkStyle } from '../src/constants/mapDarkStyle';

export default function TrackingDetail() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const mode = useThemeStore((s) => s.mode);
    const systemScheme = useColorScheme();
    const isDarkMode = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

    const mapRef = useRef<MapView>(null);
    const [isFollowingUser, setIsFollowingUser] = useState(false);

    // Store data
    const currentLocation = useLocationStore((s) => s.currentLocation);
    const distanceToTarget = useLocationStore((s) => s.distanceToTarget);
    const speed = useLocationStore((s) => s.speed);
    const trackingStartedAt = useLocationStore((s) => s.trackingStartedAt);
    const routeHistory = useLocationStore((s) => s.routeHistory);
    const traveledDistance = useLocationStore((s) => s.traveledDistance);
    const activeAlarm = useAlarmStore((s) => s.activeAlarm);

    const elapsedTime = useElapsedTime(trackingStartedAt);

    const styles = useMemo(() => createStyles(colors), [colors]);

    // Coordinates
    const startCoord = useMemo(() => {
        if (!activeAlarm) return null;
        return {
            latitude: activeAlarm.start_latitude ?? currentLocation?.coords.latitude ?? 0,
            longitude: activeAlarm.start_longitude ?? currentLocation?.coords.longitude ?? 0,
        };
    }, [activeAlarm, currentLocation]);

    const destCoord = useMemo(() => {
        if (!activeAlarm) return null;
        return {
            latitude: activeAlarm.latitude,
            longitude: activeAlarm.longitude,
        };
    }, [activeAlarm]);

    // Polyline coordinates from route history
    const polylineCoords = useMemo(() => {
        return routeHistory.map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
        }));
    }, [routeHistory]);

    // Fit map to show all points on mount
    const handleMapReady = useCallback(() => {
        if (!startCoord || !destCoord) return;

        const coords = [startCoord, destCoord];
        if (currentLocation) {
            coords.push({
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
            });
        }

        setTimeout(() => {
            mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
                animated: false,
            });
        }, 100);
    }, [startCoord, destCoord, currentLocation]);

    // "View All" button handler
    const handleViewAll = useCallback(() => {
        if (!startCoord || !destCoord) return;

        const coords = [startCoord, destCoord];
        if (currentLocation) {
            coords.push({
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
            });
        }

        mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
            animated: true,
        });
        setIsFollowingUser(false);
    }, [startCoord, destCoord, currentLocation]);

    // "Current Location" button handler
    const handleCenterOnUser = useCallback(() => {
        if (!currentLocation) return;

        mapRef.current?.animateToRegion(
            {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            },
            500,
        );
        setIsFollowingUser(true);
    }, [currentLocation]);

    // Auto-follow user location
    useEffect(() => {
        if (!isFollowingUser || !currentLocation) return;

        mapRef.current?.animateToRegion(
            {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            },
            1000,
        );
    }, [isFollowingUser, currentLocation]);

    // Disable follow when user pans
    const handlePanDrag = useCallback(() => {
        setIsFollowingUser(false);
    }, []);

    // Navigate back if no active alarm
    useEffect(() => {
        if (!activeAlarm) {
            router.back();
        }
    }, [activeAlarm]);

    if (!activeAlarm || !startCoord || !destCoord) {
        return null;
    }

    return (
        <View style={styles.container}>
            {/* Map Section - Top 50% */}
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                    style={styles.map}
                    onMapReady={handleMapReady}
                    onPanDrag={handlePanDrag}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    customMapStyle={isDarkMode ? mapDarkStyle : undefined}
                    userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
                    rotateEnabled={false}
                    pitchEnabled={false}
                >
                    {/* Start location marker */}
                    <Marker
                        coordinate={startCoord}
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <View style={styles.startMarkerContainer}>
                            <View style={styles.startMarkerInner}>
                                <Ionicons name="flag" size={16} color="#00C853" />
                            </View>
                        </View>
                    </Marker>

                    {/* Destination marker */}
                    <Marker
                        coordinate={destCoord}
                        anchor={{ x: 0.5, y: 1 }}
                    >
                        <View style={styles.destMarkerContainer}>
                            <Ionicons name="location" size={28} color={colors.error} />
                        </View>
                    </Marker>

                    {/* Traveled route polyline */}
                    {polylineCoords.length > 1 && (
                        <Polyline
                            coordinates={polylineCoords}
                            strokeColor="rgba(0, 200, 83, 0.8)"
                            strokeWidth={4}
                            lineJoin="round"
                            lineCap="round"
                        />
                    )}

                    {/* Destination radius circle */}
                    <Circle
                        center={destCoord}
                        radius={activeAlarm.radius}
                        strokeColor="rgba(49, 130, 246, 0.3)"
                        fillColor="rgba(49, 130, 246, 0.08)"
                        strokeWidth={1}
                    />
                </MapView>

                {/* Close button */}
                <Pressable
                    style={[styles.closeButton, { top: insets.top + spacing.xs }]}
                    onPress={() => router.back()}
                >
                    <Ionicons name="chevron-down" size={24} color={colors.textStrong} />
                </Pressable>

                {/* Map controls */}
                <View style={[styles.mapControls, { top: insets.top + spacing.xs }]}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.controlButton,
                            pressed && { opacity: 0.7 },
                        ]}
                        onPress={handleViewAll}
                    >
                        <Ionicons name="expand-outline" size={20} color={colors.textStrong} />
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [
                            styles.controlButton,
                            isFollowingUser && { backgroundColor: colors.primary },
                            pressed && { opacity: 0.7 },
                        ]}
                        onPress={handleCenterOnUser}
                    >
                        <Ionicons
                            name="navigate"
                            size={20}
                            color={isFollowingUser ? '#FFFFFF' : colors.textStrong}
                        />
                    </Pressable>
                </View>
            </View>

            {/* Stats Section - Bottom 50% */}
            <View style={styles.statsContainer}>
                {/* Alarm Title */}
                <View style={styles.titleSection}>
                    <Ionicons name="location" size={22} color={colors.primary} />
                    <Text style={styles.alarmTitle} numberOfLines={2}>
                        {activeAlarm.title}
                    </Text>
                </View>

                {/* Stats Grid 2x2 */}
                <View style={styles.statsGrid}>
                    {/* Remaining Distance */}
                    <View style={styles.statCard}>
                        <View style={[styles.statIconBg, { backgroundColor: `${colors.primary}15` }]}>
                            <Ionicons name="flag-outline" size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.statLabel}>{t('trackingDetail.remainingDistance')}</Text>
                        <Text style={styles.statValue}>
                            {distanceToTarget !== null ? formatDistance(distanceToTarget) : '--'}
                        </Text>
                    </View>

                    {/* Traveled Distance */}
                    <View style={styles.statCard}>
                        <View style={[styles.statIconBg, { backgroundColor: 'rgba(0, 200, 83, 0.12)' }]}>
                            <Ionicons name="footsteps-outline" size={20} color="#00C853" />
                        </View>
                        <Text style={styles.statLabel}>{t('trackingDetail.traveledDistance')}</Text>
                        <Text style={styles.statValue}>
                            {formatDistance(traveledDistance)}
                        </Text>
                    </View>

                    {/* Current Speed */}
                    <View style={styles.statCard}>
                        <View style={[styles.statIconBg, { backgroundColor: 'rgba(255, 152, 0, 0.12)' }]}>
                            <Ionicons name="speedometer-outline" size={20} color="#FF9800" />
                        </View>
                        <Text style={styles.statLabel}>{t('trackingDetail.currentSpeed')}</Text>
                        <Text style={styles.statValue}>
                            {speed !== null && speed > 0 ? speed.toFixed(1) : '0'}
                            <Text style={styles.statUnit}> {t('trackingDetail.speedUnit')}</Text>
                        </Text>
                    </View>

                    {/* Elapsed Time */}
                    <View style={styles.statCard}>
                        <View style={[styles.statIconBg, { backgroundColor: 'rgba(156, 39, 176, 0.12)' }]}>
                            <Ionicons name="time-outline" size={20} color="#9C27B0" />
                        </View>
                        <Text style={styles.statLabel}>{t('trackingDetail.elapsedTime')}</Text>
                        <Text style={styles.statValue}>{elapsedTime}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        mapContainer: {
            flex: 1,
            position: 'relative',
        },
        map: {
            flex: 1,
        },
        closeButton: {
            position: 'absolute',
            left: spacing.sm,
            zIndex: 20,
            width: 40,
            height: 40,
            borderRadius: radius.full,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            ...shadows.button,
        },
        mapControls: {
            position: 'absolute',
            right: spacing.sm,
            zIndex: 10,
            gap: spacing.xs,
        },
        controlButton: {
            width: 40,
            height: 40,
            borderRadius: radius.full,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            ...shadows.button,
        },
        startMarkerContainer: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        startMarkerInner: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(0, 200, 83, 0.15)',
            borderWidth: 2,
            borderColor: '#00C853',
            justifyContent: 'center',
            alignItems: 'center',
        },
        destMarkerContainer: {
            alignItems: 'center',
        },
        statsContainer: {
            flex: 1,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.lg,
        },
        titleSection: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginBottom: spacing.md,
        },
        alarmTitle: {
            ...typography.heading,
            color: colors.textStrong,
            flex: 1,
        },
        statsGrid: {
            flex: 1,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
        },
        statCard: {
            width: '47%',
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            padding: spacing.sm,
            gap: 6,
            ...shadows.card,
        },
        statIconBg: {
            width: 36,
            height: 36,
            borderRadius: radius.sm,
            justifyContent: 'center',
            alignItems: 'center',
        },
        statLabel: {
            ...typography.caption,
            color: colors.textMedium,
        },
        statValue: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.textStrong,
            lineHeight: 28,
        },
        statUnit: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.textMedium,
        },
    });

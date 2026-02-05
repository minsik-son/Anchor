/**
 * LocaAlert Home Screen
 * Map-First UI with Center Pin Location Picker
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Keyboard, Animated } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Circle, Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAlarmStore } from '../../src/stores/alarmStore';
import { useLocationStore } from '../../src/stores/locationStore';
import { colors, typography, spacing, radius, shadows } from '../../src/styles/theme';
import CenterPinMarker from '../../src/components/map/CenterPinMarker';
import AddressBar from '../../src/components/map/AddressBar';
import { debouncedReverseGeocode, GeocodingResult } from '../../src/services/geocoding';

export default function Home() {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [centerLocation, setCenterLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [selectedRadius] = useState(500);
    const [isFirstHint, setIsFirstHint] = useState(true);

    // Address state
    const [addressInfo, setAddressInfo] = useState<GeocodingResult>({ address: '' });
    const [isLoadingAddress, setIsLoadingAddress] = useState(false);

    // Animation values (using React Native Animated API)
    const searchBarOpacity = useRef(new Animated.Value(1)).current;

    const { activeAlarm } = useAlarmStore();
    const { currentLocation, requestPermissions } = useLocationStore();

    useEffect(() => {
        const init = async () => {
            await requestPermissions();
        };
        init();
    }, []);

    // Set initial center location when user location is available
    useEffect(() => {
        if (currentLocation && !centerLocation) {
            const newCenter = {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
            };
            setCenterLocation(newCenter);
            // Initial geocoding
            setIsLoadingAddress(true);
            debouncedReverseGeocode(newCenter.latitude, newCenter.longitude, (result) => {
                setAddressInfo(result);
                setIsLoadingAddress(false);
            });
        }
    }, [currentLocation]);

    // Animate search bar opacity
    useEffect(() => {
        Animated.timing(searchBarOpacity, {
            toValue: isDragging ? 0.3 : 1,
            duration: 150,
            useNativeDriver: true,
        }).start();
    }, [isDragging]);

    const handleRegionChange = useCallback(() => {
        if (!isDragging) {
            setIsDragging(true);
            setIsLoadingAddress(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Hide first-time hint
            if (isFirstHint) setIsFirstHint(false);
        }
    }, [isDragging, isFirstHint]);

    const handleRegionChangeComplete = useCallback((region: Region) => {
        setIsDragging(false);
        setCenterLocation({
            latitude: region.latitude,
            longitude: region.longitude,
        });

        // Haptic feedback when pin drops
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Debounced reverse geocoding
        debouncedReverseGeocode(region.latitude, region.longitude, (result) => {
            setAddressInfo(result);
            setIsLoadingAddress(false);
        });
    }, []);

    const handleCreateAlarm = () => {
        if (!centerLocation) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({
            pathname: '/alarm-setup',
            params: {
                latitude: centerLocation.latitude,
                longitude: centerLocation.longitude,
                radius: selectedRadius,
            },
        });
    };

    const userLocation = currentLocation
        ? { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude }
        : { latitude: 37.5665, longitude: 126.9780 }; // Default to Seoul

    return (
        <View style={styles.container}>
            {/* Map */}
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                    ...userLocation,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
                showsUserLocation
                showsMyLocationButton={false}
                onRegionChange={handleRegionChange}
                onRegionChangeComplete={handleRegionChangeComplete}
            >
                {/* Active alarm marker */}
                {activeAlarm && (
                    <>
                        <Marker
                            coordinate={{
                                latitude: activeAlarm.latitude,
                                longitude: activeAlarm.longitude,
                            }}
                            pinColor={colors.error}
                        />
                        <Circle
                            center={{
                                latitude: activeAlarm.latitude,
                                longitude: activeAlarm.longitude,
                            }}
                            radius={activeAlarm.radius}
                            strokeColor={colors.error}
                            strokeWidth={2}
                            fillColor={`${colors.error}20`}
                        />
                    </>
                )}
            </MapView>

            {/* Center Pin (Fixed at screen center) */}
            <CenterPinMarker isDragging={isDragging} />

            {/* Radius preview circle overlay hint */}
            {centerLocation && !isDragging && (
                <View style={styles.radiusHint} pointerEvents="none">
                    <Text style={styles.radiusHintText}>반경 {selectedRadius}m</Text>
                </View>
            )}

            {/* Search Bar (fades during drag) */}
            <Animated.View style={[styles.searchBar, { top: insets.top + spacing.sm, opacity: searchBarOpacity }]}>
                <Ionicons name="search" size={20} color={colors.textWeak} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="어디로 갈까요?"
                    placeholderTextColor={colors.textWeak}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={() => {
                        // TODO: Implement place search
                        Keyboard.dismiss();
                    }}
                />
            </Animated.View>

            {/* My Location Button */}
            <Pressable
                style={[styles.myLocationButton, { top: insets.top + spacing.sm + 56 }]}
                onPress={() => {
                    if (mapRef.current && currentLocation) {
                        mapRef.current.animateToRegion({
                            latitude: currentLocation.coords.latitude,
                            longitude: currentLocation.coords.longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        });
                    }
                }}
            >
                <Ionicons name="locate" size={24} color={colors.primary} />
            </Pressable>

            {/* Active Alarm Card */}
            {activeAlarm && (
                <View style={[styles.activeAlarmCard, { top: insets.top + spacing.sm + 56 + 56 }]}>
                    <View style={styles.activeAlarmContent}>
                        <Ionicons name="navigate" size={20} color={colors.primary} />
                        <Text style={styles.activeAlarmTitle}>{activeAlarm.title}</Text>
                    </View>
                    <Text style={styles.activeAlarmDistance}>목적지까지 계산 중...</Text>
                </View>
            )}

            {/* First time hint toast */}
            {isFirstHint && !isDragging && centerLocation && (
                <View style={styles.hintToast}>
                    <Text style={styles.hintText}>지도를 움직여 위치를 정해보세요</Text>
                </View>
            )}

            {/* Bottom Sheet */}
            <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + spacing.md }]}>
                {/* Address Bar */}
                <AddressBar
                    address={addressInfo.address}
                    detail={addressInfo.detail}
                    isLoading={isLoadingAddress}
                />

                {/* Create Alarm Button */}
                {centerLocation && (
                    <Pressable
                        style={({ pressed }) => [
                            styles.createButton,
                            pressed && styles.createButtonPressed,
                        ]}
                        onPress={handleCreateAlarm}
                    >
                        <Text style={styles.createButtonText}>여기로 알람 설정</Text>
                        <Ionicons name="arrow-forward" size={20} color={colors.surface} />
                    </Pressable>
                )}

                {/* Quick Actions */}
                {!centerLocation && (
                    <View style={styles.quickActions}>
                        <Text style={styles.quickActionsTitle}>빠른 설정</Text>
                        <View style={styles.quickActionButtons}>
                            <QuickActionButton icon="business" label="회사" />
                            <QuickActionButton icon="home" label="집" />
                            <QuickActionButton icon="cafe" label="카페" />
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

function QuickActionButton({ icon, label }: { icon: string; label: string }) {
    return (
        <Pressable style={styles.quickActionButton}>
            <Ionicons name={icon as any} size={24} color={colors.primary} />
            <Text style={styles.quickActionLabel}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    map: {
        flex: 1,
    },
    searchBar: {
        position: 'absolute',
        left: spacing.sm,
        right: 56 + spacing.sm + spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
        ...shadows.card,
    },
    searchInput: {
        flex: 1,
        ...typography.body,
        color: colors.textStrong,
    },
    myLocationButton: {
        position: 'absolute',
        right: spacing.sm,
        width: 48,
        height: 48,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.button,
    },
    activeAlarmCard: {
        position: 'absolute',
        left: spacing.sm,
        right: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.sm,
        ...shadows.card,
    },
    activeAlarmContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: 4,
    },
    activeAlarmTitle: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '700',
    },
    activeAlarmDistance: {
        ...typography.caption,
        color: colors.textMedium,
    },
    radiusHint: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: 20,
        marginLeft: -40,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    radiusHintText: {
        ...typography.caption,
        color: colors.surface,
        fontWeight: '600',
    },
    hintToast: {
        position: 'absolute',
        top: '40%',
        left: spacing.md,
        right: spacing.md,
        backgroundColor: 'rgba(0,0,0,0.75)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.md,
        alignItems: 'center',
    },
    hintText: {
        ...typography.body,
        color: colors.surface,
        fontWeight: '500',
    },
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        gap: spacing.sm,
        ...shadows.card,
    },
    createButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
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
    quickActions: {
        marginTop: spacing.xs,
    },
    quickActionsTitle: {
        ...typography.caption,
        color: colors.textWeak,
        marginBottom: spacing.xs,
    },
    quickActionButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    quickActionButton: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        gap: 4,
    },
    quickActionLabel: {
        ...typography.caption,
        color: colors.textMedium,
    },
});

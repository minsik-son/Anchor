/**
 * LocaAlert Home Screen
 * Map-First UI with Center Pin Location Picker
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Keyboard, Animated, FlatList } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Circle, Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useAlarmStore } from '../../src/stores/alarmStore';
import { useLocationStore } from '../../src/stores/locationStore';
import { colors, typography, spacing, radius, shadows } from '../../src/styles/theme';
import CenterPinMarker from '../../src/components/map/CenterPinMarker';
import AddressBar from '../../src/components/map/AddressBar';
import { debouncedReverseGeocode, GeocodingResult } from '../../src/services/geocoding';

interface SearchResult {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
}

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

    // Search state
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);

    // Animation values (using React Native Animated API)
    const searchBarOpacity = useRef(new Animated.Value(1)).current;

    // Ref to track if map is being dragged
    const isDraggingRef = useRef(false);

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

    // Search for places using geocoding
    const handleSearch = useCallback(async (query: string) => {
        setSearchQuery(query);

        if (query.length < 2) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        setIsSearching(true);
        setShowSearchResults(true);

        try {
            // Use expo-location geocoding
            const results = await Location.geocodeAsync(query);

            const searchResults: SearchResult[] = results.slice(0, 5).map((result, index) => ({
                id: `${index}`,
                name: query,
                address: `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`,
                latitude: result.latitude,
                longitude: result.longitude,
            }));

            // Also reverse geocode to get proper addresses
            const enrichedResults = await Promise.all(
                searchResults.map(async (result) => {
                    try {
                        const reverseResults = await Location.reverseGeocodeAsync({
                            latitude: result.latitude,
                            longitude: result.longitude,
                        });
                        if (reverseResults.length > 0) {
                            const r = reverseResults[0];
                            return {
                                ...result,
                                name: r.name || r.street || query,
                                address: [r.city, r.district, r.street, r.streetNumber]
                                    .filter(Boolean)
                                    .join(' ') || result.address,
                            };
                        }
                    } catch (e) {
                        // Ignore individual reverse geocode errors
                    }
                    return result;
                })
            );

            setSearchResults(enrichedResults);
        } catch (error) {
            console.error('[Search] Failed to geocode:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleSelectSearchResult = useCallback((result: SearchResult) => {
        setShowSearchResults(false);
        setSearchQuery('');
        Keyboard.dismiss();

        // Move map to selected location
        if (mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: result.latitude,
                longitude: result.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });
        }

        // Update center location
        setCenterLocation({
            latitude: result.latitude,
            longitude: result.longitude,
        });

        // Update address
        setAddressInfo({
            address: result.address,
            detail: result.name,
        });

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, []);

    const handleRegionChange = useCallback(() => {
        // Only set dragging if not already dragging (prevent repeated calls)
        if (!isDraggingRef.current) {
            isDraggingRef.current = true;
            setIsDragging(true);
            setIsLoadingAddress(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Hide first-time hint
            if (isFirstHint) setIsFirstHint(false);
            // Hide search results when dragging
            setShowSearchResults(false);
        }
    }, [isFirstHint]);

    const handleRegionChangeComplete = useCallback((region: Region) => {
        // Always reset dragging state when gesture ends
        isDraggingRef.current = false;
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

            {/* Top Bar Container - Search + Location Button aligned */}
            <View style={[styles.topBarContainer, { top: insets.top + spacing.sm }]}>
                {/* Search Bar (fades during drag) */}
                <Animated.View style={[styles.searchBar, { opacity: searchBarOpacity }]}>
                    <Ionicons name="search" size={20} color={colors.textWeak} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="어디로 갈까요?"
                        placeholderTextColor={colors.textWeak}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                        onSubmitEditing={() => {
                            Keyboard.dismiss();
                        }}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <Pressable onPress={() => {
                            setSearchQuery('');
                            setSearchResults([]);
                            setShowSearchResults(false);
                        }}>
                            <Ionicons name="close-circle" size={20} color={colors.textWeak} />
                        </Pressable>
                    )}
                </Animated.View>

                {/* My Location Button - Same height as search bar */}
                <Pressable
                    style={styles.myLocationButton}
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
            </View>

            {/* Search Results Dropdown */}
            {showSearchResults && (
                <View style={[styles.searchResultsContainer, { top: insets.top + spacing.sm + 56 }]}>
                    {isSearching ? (
                        <View style={styles.searchLoadingContainer}>
                            <Text style={styles.searchLoadingText}>검색 중...</Text>
                        </View>
                    ) : searchResults.length > 0 ? (
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item) => item.id}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => (
                                <Pressable
                                    style={styles.searchResultItem}
                                    onPress={() => handleSelectSearchResult(item)}
                                >
                                    <Ionicons name="location-outline" size={20} color={colors.textMedium} />
                                    <View style={styles.searchResultTextContainer}>
                                        <Text style={styles.searchResultName} numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        <Text style={styles.searchResultAddress} numberOfLines={1}>
                                            {item.address}
                                        </Text>
                                    </View>
                                </Pressable>
                            )}
                        />
                    ) : searchQuery.length >= 2 ? (
                        <View style={styles.searchLoadingContainer}>
                            <Text style={styles.searchLoadingText}>검색 결과가 없습니다</Text>
                        </View>
                    ) : null}
                </View>
            )}

            {/* Active Alarm Card */}
            {activeAlarm && !showSearchResults && (
                <View style={[styles.activeAlarmCard, { top: insets.top + spacing.sm + 56 }]}>
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
    topBarContainer: {
        position: 'absolute',
        left: spacing.sm,
        right: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        height: 48,
        gap: spacing.xs,
        ...shadows.card,
    },
    searchInput: {
        flex: 1,
        ...typography.body,
        color: colors.textStrong,
        height: '100%',
    },
    myLocationButton: {
        width: 48,
        height: 48,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.button,
    },
    searchResultsContainer: {
        position: 'absolute',
        left: spacing.sm,
        right: spacing.sm,
        maxHeight: 250,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        ...shadows.card,
        overflow: 'hidden',
    },
    searchLoadingContainer: {
        padding: spacing.md,
        alignItems: 'center',
    },
    searchLoadingText: {
        ...typography.body,
        color: colors.textMedium,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.sm,
        gap: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.background,
    },
    searchResultTextContainer: {
        flex: 1,
    },
    searchResultName: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
    },
    searchResultAddress: {
        ...typography.caption,
        color: colors.textMedium,
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

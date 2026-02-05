/**
 * LocaAlert Home Screen
 * Map-First UI with Center Pin Location Picker
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Keyboard, Animated, FlatList, ActivityIndicator, Alert } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Circle, Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Slider from '@react-native-community/slider';
import { useAlarmStore } from '../../src/stores/alarmStore';
import { useLocationStore } from '../../src/stores/locationStore';
import { useFavoritePlaceStore } from '../../src/stores/favoritePlaceStore';
import { colors, typography, spacing, radius, shadows } from '../../src/styles/theme';
import CenterPinMarker from '../../src/components/map/CenterPinMarker';
import AddressBar from '../../src/components/map/AddressBar';
import { debouncedReverseGeocode, GeocodingResult } from '../../src/services/geocoding';
import {
    PlaceResult,
    debouncedSearchPlaces,
    cancelPendingSearch,
    getGooglePlaceDetails,
    resetSessionToken,
    isInKorea
} from '../../src/services/placeSearch';

export default function Home() {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [centerLocation, setCenterLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [selectedRadius, setSelectedRadius] = useState(500);
    const [isFirstHint, setIsFirstHint] = useState(true);
    const [showRadiusSlider, setShowRadiusSlider] = useState(false);

    // Address state
    const [addressInfo, setAddressInfo] = useState<GeocodingResult>({ address: '' });
    const [isLoadingAddress, setIsLoadingAddress] = useState(false);

    // Search state
    const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);

    // Animation values (using React Native Animated API)
    const searchBarOpacity = useRef(new Animated.Value(1)).current;
    const sliderHeight = useRef(new Animated.Value(0)).current;

    // Ref to track if map is being dragged by user
    const isDraggingRef = useRef(false);
    // Ref to track programmatic map animations (to prevent pin lift)
    const isAnimatingRef = useRef(false);

    const { activeAlarm } = useAlarmStore();
    const { currentLocation, requestPermissions, getCurrentLocation } = useLocationStore();
    const { favorites, loadFavorites, deleteFavorite } = useFavoritePlaceStore();

    useEffect(() => {
        const init = async () => {
            await requestPermissions();
            await getCurrentLocation();
            await loadFavorites();
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

    // Animate radius slider height (fast and responsive)
    useEffect(() => {
        Animated.timing(sliderHeight, {
            toValue: showRadiusSlider ? 1 : 0,
            duration: 150, // Faster for better responsiveness
            useNativeDriver: false, // Height animation needs JS thread
        }).start();
    }, [showRadiusSlider]);

    // Default location for search (Seoul if no current location)
    const defaultLocation = currentLocation
        ? { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude }
        : { latitude: 37.5665, longitude: 126.9780 };

    // Search for places using hybrid search
    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query);

        if (query.length < 2) {
            setSearchResults([]);
            setShowSearchResults(false);
            cancelPendingSearch();
            return;
        }

        setIsSearching(true);
        setShowSearchResults(true);

        debouncedSearchPlaces(
            {
                query,
                currentLocation: centerLocation || defaultLocation,
                language: 'ko',
            },
            (results) => {
                setSearchResults(results);
                setIsSearching(false);
            },
            350
        );
    }, [centerLocation, defaultLocation]);

    const handleSelectSearchResult = useCallback(async (result: PlaceResult) => {
        setShowSearchResults(false);
        setSearchQuery('');
        Keyboard.dismiss();

        let finalLocation: { latitude: number; longitude: number } | null = null;

        // Kakao and Expo results have coordinates directly
        if (result.latitude !== undefined && result.longitude !== undefined) {
            finalLocation = {
                latitude: result.latitude,
                longitude: result.longitude,
            };
        }
        // Google results need an additional API call
        else if (result.source === 'GOOGLE' && result.placeId) {
            setIsLoadingAddress(true);
            const coords = await getGooglePlaceDetails(result.placeId, '');
            if (coords) {
                finalLocation = coords;
            }
        }

        if (!finalLocation) {
            console.error('[Home] Could not get coordinates for selected place');
            setIsLoadingAddress(false);
            return;
        }

        // Move map to selected location (prevent pin lift during animation)
        if (mapRef.current) {
            isAnimatingRef.current = true;
            mapRef.current.animateToRegion({
                latitude: finalLocation.latitude,
                longitude: finalLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 400);
            // Reset animation flag after animation completes
            setTimeout(() => {
                isAnimatingRef.current = false;
            }, 450);
        }

        // Update center location
        setCenterLocation(finalLocation);

        // Update address
        setAddressInfo({
            address: result.address,
            detail: result.name,
        });
        setIsLoadingAddress(false);

        // Reset session token after selection (for Google billing optimization)
        resetSessionToken();

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, []);

    // Handle user pan/drag gesture (NOT programmatic map changes)
    // This prevents Circle rendering from triggering pin lifts
    const handlePanDrag = useCallback(() => {
        // Skip if programmatic animation is in progress
        if (isAnimatingRef.current) {
            return;
        }

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
            // Hide radius slider when dragging
            setShowRadiusSlider(false);
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

    // Handle My Location button press
    const handleMyLocationPress = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Get current location (this will update the store and return the location)
        const location = await getCurrentLocation();

        if (!location) {
            console.log('[Home] Could not get current location');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }

        const myLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        };

        // Animate map to current location (prevent pin lift during animation)
        if (mapRef.current) {
            isAnimatingRef.current = true;
            mapRef.current.animateToRegion({
                ...myLocation,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 500);
            // Reset animation flag after animation completes
            setTimeout(() => {
                isAnimatingRef.current = false;
            }, 550);
        }

        // Update center location
        setCenterLocation(myLocation);

        // Trigger reverse geocoding for this location
        setIsLoadingAddress(true);
        debouncedReverseGeocode(myLocation.latitude, myLocation.longitude, (result) => {
            setAddressInfo(result);
            setIsLoadingAddress(false);
        });

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, [getCurrentLocation]);

    const handleCreateAlarm = () => {
        if (!centerLocation) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({
            pathname: '/alarm-setup',
            params: {
                latitude: centerLocation.latitude,
                longitude: centerLocation.longitude,
                radius: selectedRadius,
                address: addressInfo.address || '',
                locationName: addressInfo.detail || addressInfo.district || '',
            },
        });
    };

    const handleRadiusChange = (value: number) => {
        // Round to nearest 50m
        const roundedValue = Math.round(value / 50) * 50;
        setSelectedRadius(roundedValue);
    };

    // Jump to favorite location
    const handleJumpToFavorite = (favorite: { latitude: number; longitude: number; radius: number; label: string }) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Keyboard.dismiss();
        setShowSearchResults(false);

        isAnimatingRef.current = true;

        const newLocation = {
            latitude: favorite.latitude,
            longitude: favorite.longitude,
        };

        // Animate map to location
        mapRef.current?.animateToRegion({
            ...newLocation,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        }, 500);

        // Update state
        setCenterLocation(newLocation);
        setSelectedRadius(favorite.radius);

        // Reverse geocode the location
        setIsLoadingAddress(true);
        debouncedReverseGeocode(newLocation.latitude, newLocation.longitude, (result) => {
            setAddressInfo(result);
            setIsLoadingAddress(false);
        });

        // Reset animation flag after animation completes
        setTimeout(() => {
            isAnimatingRef.current = false;
        }, 600);
    };

    const userLocation = currentLocation
        ? { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude }
        : { latitude: 37.5665, longitude: 126.9780 }; // Default to Seoul

    // Determine search source indicator
    const searchSourceLabel = centerLocation && isInKorea(centerLocation.latitude, centerLocation.longitude)
        ? '🇰🇷'
        : '🌍';

    // Format radius for display
    const formatRadius = (meters: number) => {
        if (meters >= 1000) {
            return `${(meters / 1000).toFixed(1)}km`;
        }
        return `${meters}m`;
    };

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
                onPress={(e) => {
                    // Instant close without waiting for animation
                    if (showRadiusSlider) {
                        setShowRadiusSlider(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                }}
                onPanDrag={handlePanDrag}
                onRegionChangeComplete={handleRegionChangeComplete}
            >
                {/* Radius preview circle */}
                {centerLocation && !isDragging && (
                    <Circle
                        center={centerLocation}
                        radius={selectedRadius}
                        strokeColor={colors.primary}
                        strokeWidth={2}
                        fillColor={`${colors.primary}20`}
                    />
                )}

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

            {/* Invisible overlay to close radius slider and keyboard - INSTANT response */}
            {(showRadiusSlider || showSearchResults) && (
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => {
                        Keyboard.dismiss();
                        setShowRadiusSlider(false);
                        setShowSearchResults(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                />
            )}

            {/* Center Pin (Fixed at screen center) */}
            <CenterPinMarker isDragging={isDragging} />

            {/* Top Bar Container - Search + Location Button aligned */}
            <View style={[styles.topBarContainer, { top: insets.top + spacing.sm }]}>
                {/* Search Bar (fades during drag) */}
                <Animated.View style={[styles.searchBar, { opacity: searchBarOpacity }]}>
                    <Ionicons name="search" size={20} color={colors.textWeak} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={`어디로 갈까요? ${searchSourceLabel}`}
                        placeholderTextColor={colors.textWeak}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        onFocus={() => {
                            searchQuery.length >= 2 && setShowSearchResults(true);
                            setShowRadiusSlider(false);
                        }}
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
                            cancelPendingSearch();
                        }}>
                            <Ionicons name="close-circle" size={20} color={colors.textWeak} />
                        </Pressable>
                    )}
                </Animated.View>

                {/* My Location Button - Same height as search bar */}
                <Pressable
                    style={styles.myLocationButton}
                    onPress={handleMyLocationPress}
                >
                    <Ionicons name="locate" size={24} color={colors.primary} />
                </Pressable>
            </View>

            {/* Search Results Dropdown */}
            {showSearchResults && (
                <View style={[styles.searchResultsContainer, { top: insets.top + spacing.sm + 56 }]}>
                    {isSearching ? (
                        <View style={styles.searchLoadingContainer}>
                            <ActivityIndicator size="small" color={colors.primary} />
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
                                    <View style={styles.searchResultIconContainer}>
                                        <Ionicons
                                            name={item.source === 'KAKAO' ? 'location' : 'location-outline'}
                                            size={20}
                                            color={item.source === 'KAKAO' ? colors.primary : colors.textMedium}
                                        />
                                    </View>
                                    <View style={styles.searchResultTextContainer}>
                                        <Text style={styles.searchResultName} numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        <Text style={styles.searchResultAddress} numberOfLines={1}>
                                            {item.address}
                                        </Text>
                                    </View>
                                    <Text style={styles.searchResultSource}>
                                        {item.source === 'KAKAO' ? '🇰🇷' : item.source === 'GOOGLE' ? '🌍' : '📍'}
                                    </Text>
                                </Pressable>
                            )}
                        />
                    ) : searchQuery.length >= 2 ? (
                        <View style={styles.searchLoadingContainer}>
                            <Ionicons name="search-outline" size={24} color={colors.textWeak} />
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
            <View style={[styles.bottomSheet, { paddingBottom: insets.bottom }]}>
                {/* Address Bar with Radius Chip */}
                <View style={styles.addressRow}>
                    <View style={styles.addressBarWrapper}>
                        <AddressBar
                            address={addressInfo.address}
                            detail={addressInfo.detail}
                            isLoading={isLoadingAddress}
                        />
                    </View>

                    {/* Radius Chip - Tappable to show slider */}
                    {centerLocation && (
                        <Pressable
                            style={[
                                styles.radiusChip,
                                showRadiusSlider && styles.radiusChipActive
                            ]}
                            onPress={() => {
                                setShowRadiusSlider(!showRadiusSlider);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                        >
                            <Ionicons
                                name="radio-button-on"
                                size={14}
                                color={showRadiusSlider ? colors.surface : colors.primary}
                            />
                            <Text style={[
                                styles.radiusChipText,
                                showRadiusSlider && styles.radiusChipTextActive
                            ]}>
                                {formatRadius(selectedRadius)}
                            </Text>
                        </Pressable>
                    )}
                </View>

                {/* Radius Slider (shown when chip is tapped) */}
                {centerLocation && (
                    <Animated.View
                        style={[
                            styles.radiusSliderContainer,
                            {
                                maxHeight: sliderHeight.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 120], // 0 to full height
                                }),
                                opacity: sliderHeight,
                                overflow: 'hidden',
                            }
                        ]}
                    >
                        <View style={styles.radiusSliderHeader}>
                            <Text style={styles.radiusSliderLabel}>알림 반경</Text>
                            <Text style={styles.radiusSliderValue}>{formatRadius(selectedRadius)}</Text>
                        </View>
                        <Slider
                            style={styles.radiusSlider}
                            minimumValue={100}
                            maximumValue={2000}
                            step={50}
                            value={selectedRadius}
                            onValueChange={handleRadiusChange}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor={`${colors.textWeak}50`}
                            thumbTintColor={colors.primary}
                        />
                        <View style={styles.radiusSliderLabels}>
                            <Text style={styles.radiusSliderMinMax}>100m</Text>
                            <Text style={styles.radiusSliderMinMax}>2km</Text>
                        </View>
                    </Animated.View>
                )}

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

                {/* Quick Actions - Favorite Places (Compact) */}
                <View style={styles.quickActionsCompact}>
                    {favorites.map((fav) => (
                        <Pressable
                            key={fav.id}
                            style={styles.quickChip}
                            onPress={() => handleJumpToFavorite(fav)}
                            onLongPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                Alert.alert(
                                    '즐겨찾기 삭제',
                                    `"${fav.label}"을(를) 삭제하시겠습니까?`,
                                    [
                                        { text: '취소', style: 'cancel' },
                                        { text: '삭제', style: 'destructive', onPress: () => deleteFavorite(fav.id) },
                                    ]
                                );
                            }}
                        >
                            <Ionicons name={fav.icon as any} size={16} color={colors.primary} />
                            <Text style={styles.quickChipLabel}>{fav.label}</Text>
                        </Pressable>
                    ))}
                    {favorites.length < 3 && (
                        <Pressable
                            style={styles.quickChipAdd}
                            onPress={() => {
                                if (centerLocation) {
                                    router.push({
                                        pathname: '/favorite-place-setup',
                                        params: {
                                            latitude: centerLocation.latitude,
                                            longitude: centerLocation.longitude,
                                            address: addressInfo.address || '',
                                        },
                                    });
                                }
                            }}
                        >
                            <Ionicons name="add" size={16} color={colors.textWeak} />
                            <Text style={styles.quickChipLabelAdd}>즐겨찾기</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </View>
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
        maxHeight: 300,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        ...shadows.card,
        overflow: 'hidden',
    },
    searchLoadingContainer: {
        padding: spacing.md,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.xs,
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
    searchResultIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: `${colors.primary}15`,
        justifyContent: 'center',
        alignItems: 'center',
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
    searchResultSource: {
        fontSize: 14,
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
        paddingHorizontal: spacing.sm,
        paddingTop: 12,
        gap: 8,
        ...shadows.card,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    addressBarWrapper: {
        flex: 1,
    },
    radiusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${colors.primary}15`,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.md,
        gap: 4,
    },
    radiusChipActive: {
        backgroundColor: colors.primary,
    },
    radiusChipText: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '600',
    },
    radiusChipTextActive: {
        color: colors.surface,
    },
    radiusSliderContainer: {
        backgroundColor: colors.background,
        borderRadius: radius.md,
        padding: spacing.sm,
    },
    radiusSliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    radiusSliderLabel: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
    },
    radiusSliderValue: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '700',
    },
    radiusSlider: {
        width: '100%',
        height: 40,
    },
    radiusSliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    radiusSliderMinMax: {
        ...typography.caption,
        color: colors.textWeak,
    },
    createButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: 12,
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
    quickActionsCompact: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginTop: 0,
    },
    quickChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        backgroundColor: colors.background,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    quickChipLabel: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '600',
    },
    quickChipAdd: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        backgroundColor: colors.background,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.textWeak,
        borderStyle: 'dashed',
    },
    quickChipLabelAdd: {
        ...typography.caption,
        color: colors.textWeak,
    },
});

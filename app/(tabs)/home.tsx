/**
 * LocaAlert Home Screen
 * Map-First UI with Center Pin Location Picker
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Keyboard, Animated, FlatList, ActivityIndicator, Alert, Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Details, PROVIDER_GOOGLE, Circle, Marker, Region, UrlTile, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';
import { useAlarmStore } from '../../src/stores/alarmStore';
import { useLocationStore } from '../../src/stores/locationStore';
import { useFavoritePlaceStore } from '../../src/stores/favoritePlaceStore';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../../src/styles/theme';
import CenterPinMarker from '../../src/components/map/CenterPinMarker';
import AddressBar from '../../src/components/map/AddressBar';
import NavigationPanel from '../../src/components/navigation/NavigationPanel';
import AlarmDashboard from '../../src/components/alarm/AlarmDashboard';
import { debouncedReverseGeocode, GeocodingResult, clearGeocodeCache } from '../../src/services/geocoding';
import { PlaceResult, isInKorea } from '../../src/services/placeSearch';
import { formatDistance } from '../../src/services/location/geofence';
import { mapDarkStyle } from '../../src/constants/mapDarkStyle';
import { useThemeStore } from '../../src/stores/themeStore';
import { useElapsedTime } from '../../src/hooks/useElapsedTime';
import { useLocationSearch } from '../../src/hooks/useLocationSearch';
import { useMapAnimation } from '../../src/hooks/useMapAnimation';

export default function Home() {
    const insets = useSafeAreaInsets();
    const { t, i18n } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const themeMode = useThemeStore((state) => state.mode);
    const systemScheme = useColorScheme();
    const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');

    const { mapRef, isAnimatingRef, animateToLocation, animateToCenter } = useMapAnimation();

    // Follow mode: auto-center map on user location during alarm tracking
    const [isFollowMode, setIsFollowMode] = useState(false);
    const isFollowModeRef = useRef(false);

    const [isDragging, setIsDragging] = useState(false);
    const [centerLocation, setCenterLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [selectedRadius, setSelectedRadius] = useState(100);
    const [isFirstHint, setIsFirstHint] = useState(false);
    const hintOpacity = useRef(new Animated.Value(1)).current;
    const [showRadiusSlider, setShowRadiusSlider] = useState(false);

    // Address state
    const [addressInfo, setAddressInfo] = useState<GeocodingResult>({ address: '' });
    const [isLoadingAddress, setIsLoadingAddress] = useState(false);

    // Animation values (using React Native Animated API)
    const searchBarOpacity = useRef(new Animated.Value(1)).current;
    const sliderHeight = useRef(new Animated.Value(0)).current;

    // Ref to track if map is being dragged by user
    const isDraggingRef = useRef(false);

    const { activeAlarm, deactivateAlarm, loadMemos, currentMemos } = useAlarmStore();
    const {
        currentLocation,
        requestPermissions,
        getCurrentLocation,
        isNavigating,
        selectedRoute,
        stopNavigation,
        stopTracking,
        distanceToTarget,
    } = useLocationStore();
    const { favorites, loadFavorites, deleteFavorite } = useFavoritePlaceStore();
    const elapsedTime = useElapsedTime(activeAlarm?.started_at ?? null);

    // Default location for search (Seoul if no current location)
    const defaultLocation = currentLocation
        ? { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude }
        : { latitude: 37.5665, longitude: 126.9780 };

    const {
        searchQuery,
        searchResults,
        isSearching,
        showSearchResults,
        setShowSearchResults,
        handleSearch,
        resolveSearchResult,
        clearSearch,
    } = useLocationSearch({ centerLocation, defaultLocation });

    useEffect(() => {
        const init = async () => {
            await requestPermissions();
            const location = await getCurrentLocation();
            await loadFavorites();

            if (location) {
                const userPos = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                };
                setCenterLocation(userPos);
                animateToLocation(userPos);

                setIsLoadingAddress(true);
                debouncedReverseGeocode(userPos.latitude, userPos.longitude, (result) => {
                    setAddressInfo(result);
                    setIsLoadingAddress(false);
                });
            }
        };
        init();
    }, []);

    // Show map hint only on first-ever app launch, then auto-fade
    useEffect(() => {
        const HINT_SHOWN_KEY = 'map_hint_shown';

        AsyncStorage.getItem(HINT_SHOWN_KEY).then((value) => {
            if (value !== 'true') {
                setIsFirstHint(true);
                AsyncStorage.setItem(HINT_SHOWN_KEY, 'true');

                const timer = setTimeout(() => {
                    Animated.timing(hintOpacity, {
                        toValue: 0,
                        duration: 500,
                        useNativeDriver: true,
                    }).start(() => setIsFirstHint(false));
                }, 3000);

                return () => clearTimeout(timer);
            }
        });
    }, []);

    // Load memos when activeAlarm changes
    useEffect(() => {
        if (activeAlarm) {
            loadMemos(activeAlarm.id);
        }
    }, [activeAlarm]);

    // Auto-enable follow mode when alarm activates, disable on cancel/navigation
    useEffect(() => {
        const shouldFollow = activeAlarm !== null && !isNavigating;
        isFollowModeRef.current = shouldFollow;
        setIsFollowMode(shouldFollow);
    }, [activeAlarm, isNavigating]);

    // Follow mode: auto-center map on user location updates
    useEffect(() => {
        if (!isFollowModeRef.current || !activeAlarm || !currentLocation) return;
        animateToCenter({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
        }, 500);
    }, [currentLocation, activeAlarm, animateToCenter]);

    // Fit map to route when navigation starts
    useEffect(() => {
        if (isNavigating && selectedRoute && mapRef.current) {
            const allCoordinates = [...selectedRoute.coordinates];
            if (currentLocation) {
                allCoordinates.unshift({
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                });
            }

            setTimeout(() => {
                mapRef.current?.fitToCoordinates(allCoordinates, {
                    edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
                    animated: true,
                });
            }, 300);
        }
    }, [isNavigating, selectedRoute]);

    // Set initial center location when user location is available
    useEffect(() => {
        if (currentLocation && !centerLocation) {
            const newCenter = {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
            };
            setCenterLocation(newCenter);
            setIsLoadingAddress(true);
            debouncedReverseGeocode(newCenter.latitude, newCenter.longitude, (result) => {
                setAddressInfo(result);
                setIsLoadingAddress(false);
            });
        }
    }, [currentLocation]);

    // Re-fetch address when language changes
    useEffect(() => {
        const handleLanguageChanged = (newLang: string) => {
            if (centerLocation) {
                clearGeocodeCache();
                setIsLoadingAddress(true);
                debouncedReverseGeocode(centerLocation.latitude, centerLocation.longitude, (result) => {
                    setAddressInfo(result);
                    setIsLoadingAddress(false);
                });
            }
        };

        i18n.on('languageChanged', handleLanguageChanged);
        return () => {
            i18n.off('languageChanged', handleLanguageChanged);
        };
    }, [centerLocation]);

    // Animate search bar opacity
    useEffect(() => {
        Animated.timing(searchBarOpacity, {
            toValue: isDragging ? 0.3 : 1,
            duration: 150,
            useNativeDriver: true,
        }).start();
    }, [isDragging]);

    // Animate radius slider height
    useEffect(() => {
        Animated.timing(sliderHeight, {
            toValue: showRadiusSlider ? 1 : 0,
            duration: 150,
            useNativeDriver: false,
        }).start();
    }, [showRadiusSlider]);

    const handleSelectSearchResult = useCallback(async (result: PlaceResult) => {
        setShowSearchResults(false);
        Keyboard.dismiss();

        setIsLoadingAddress(true);
        const resolved = await resolveSearchResult(result);

        if (!resolved) {
            setIsLoadingAddress(false);
            return;
        }

        animateToLocation(resolved.location, 400);
        setCenterLocation(resolved.location);
        setAddressInfo({ address: resolved.address, detail: resolved.name });
        setIsLoadingAddress(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, [resolveSearchResult, animateToLocation]);

    const handleRegionChange = useCallback((_region: Region, details: Details) => {
        if (isAnimatingRef.current) return;
        if (isDraggingRef.current) return;

        isDraggingRef.current = true;
        isFollowModeRef.current = false;
        setIsFollowMode(false);
        setIsDragging(true);
        setIsLoadingAddress(true);
        Keyboard.dismiss();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowSearchResults(false);
        setShowRadiusSlider(false);
    }, []);

    const handleRegionChangeComplete = useCallback((region: Region) => {
        // Skip region changes from programmatic animations (follow mode, search, etc.)
        // All programmatic call sites manage state directly, so this is always redundant.
        if (isAnimatingRef.current) return;

        isDraggingRef.current = false;
        setIsDragging(false);

        setCenterLocation({
            latitude: region.latitude,
            longitude: region.longitude,
        });

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        debouncedReverseGeocode(region.latitude, region.longitude, (result) => {
            setAddressInfo(result);
            setIsLoadingAddress(false);
        });
    }, []);

    const handleMyLocationPress = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const location = await getCurrentLocation();

        if (!location) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }

        const myLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        };

        // Re-enable follow mode during alarm tracking (preserves zoom)
        if (activeAlarm && !isNavigating) {
            isFollowModeRef.current = true;
            setIsFollowMode(true);
            animateToCenter(myLocation);
        } else {
            animateToLocation(myLocation);
        }

        setCenterLocation(myLocation);

        setIsLoadingAddress(true);
        debouncedReverseGeocode(myLocation.latitude, myLocation.longitude, (result) => {
            setAddressInfo(result);
            setIsLoadingAddress(false);
        });

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, [getCurrentLocation, animateToLocation, animateToCenter, activeAlarm, isNavigating]);

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
        const roundedValue = Math.round(value / 50) * 50;
        setSelectedRadius(roundedValue);
    };

    const handleCancelAlarm = () => {
        Alert.alert(
            t('alarmDashboard.cancelConfirm.title'),
            t('alarmDashboard.cancelConfirm.message'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('alarmDashboard.cancelConfirm.confirm'),
                    style: 'destructive',
                    onPress: async () => {
                        if (activeAlarm) {
                            await deactivateAlarm(activeAlarm.id);
                        }
                        stopTracking();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    },
                },
            ]
        );
    };

    const handleJumpToFavorite = (favorite: { latitude: number; longitude: number; radius: number; label: string }) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Keyboard.dismiss();
        setShowSearchResults(false);

        const newLocation = {
            latitude: favorite.latitude,
            longitude: favorite.longitude,
        };

        animateToLocation(newLocation);
        setCenterLocation(newLocation);
        setSelectedRadius(favorite.radius);

        setIsLoadingAddress(true);
        debouncedReverseGeocode(newLocation.latitude, newLocation.longitude, (result) => {
            setAddressInfo(result);
            setIsLoadingAddress(false);
        });
    };

    const userLocation = currentLocation
        ? { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude }
        : { latitude: 37.5665, longitude: 126.9780 };

    return (
        <View style={styles.container}>
            {/* Map */}
            <MapView
                ref={mapRef}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                style={styles.map}
                initialRegion={{
                    ...userLocation,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
                showsUserLocation
                showsMyLocationButton={false}
                customMapStyle={isDarkMode ? mapDarkStyle : undefined}
                userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
                scrollEnabled={!isNavigating || true}
                zoomEnabled={!isNavigating || true}
                rotateEnabled={!isNavigating}
                pitchEnabled={!isNavigating}
                onPress={() => {
                    if (isNavigating) return;
                    Keyboard.dismiss();
                    if (showSearchResults) setShowSearchResults(false);
                    if (showRadiusSlider) {
                        setShowRadiusSlider(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                }}
                onRegionChange={isNavigating ? undefined : handleRegionChange}
                onRegionChangeComplete={isNavigating ? undefined : handleRegionChangeComplete}
            >
                {/* OSM Tile Overlay for Android */}
                {Platform.OS === 'android' && (
                    <UrlTile
                        urlTemplate={centerLocation && isInKorea(centerLocation.latitude, centerLocation.longitude)
                            ? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                            : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
                        maximumZ={19}
                        flipY={false}
                        zIndex={-1}
                    />
                )}
                {/* Radius preview circle (setup mode only) */}
                {centerLocation && !isDragging && !activeAlarm && (
                    <Circle
                        center={centerLocation}
                        radius={selectedRadius}
                        strokeColor={colors.primary}
                        strokeWidth={2}
                        fillColor={`${colors.primary}20`}
                    />
                )}

                {/* Debug: Red dot at exact coordinates */}
                {!activeAlarm && centerLocation && !isDragging && (
                    <Marker
                        coordinate={centerLocation}
                        anchor={{ x: 0.5, y: 0.5 }}
                        tracksViewChanges={false}
                    >
                        <View style={styles.debugDot} />
                    </Marker>
                )}
                {activeAlarm && (
                    <Marker
                        coordinate={{
                            latitude: activeAlarm.latitude,
                            longitude: activeAlarm.longitude,
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                        tracksViewChanges={false}
                        zIndex={10}
                    >
                        <View style={styles.debugDot} />
                    </Marker>
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

                {/* Navigation route polyline */}
                {isNavigating && selectedRoute && (
                    <Polyline
                        coordinates={selectedRoute.coordinates}
                        strokeColor={colors.primary}
                        strokeWidth={4}
                    />
                )}

                {/* Active alarm connection line (user → destination) */}
                {activeAlarm && currentLocation && !isNavigating && (
                    <Polyline
                        coordinates={[
                            {
                                latitude: currentLocation.coords.latitude,
                                longitude: currentLocation.coords.longitude,
                            },
                            {
                                latitude: activeAlarm.latitude,
                                longitude: activeAlarm.longitude,
                            },
                        ]}
                        strokeColor={colors.primary}
                        strokeWidth={3}
                    />
                )}
            </MapView>

            {/* Invisible overlay to close radius slider and keyboard */}
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

            {/* Center Pin (Fixed at screen center - hidden during navigation) */}
            {!isNavigating && !activeAlarm && <CenterPinMarker isDragging={isDragging} />}

            {/* Top Bar Container - Search + Location Button aligned */}
            <View style={[styles.topBarContainer, { top: insets.top + spacing.sm }]}>
                <Animated.View style={[styles.searchBar, { opacity: searchBarOpacity }]}>
                    <Ionicons name="search" size={20} color={colors.textWeak} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('home.searchPlaceholder')}
                        placeholderTextColor={colors.textWeak}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        onFocus={() => {
                            searchQuery.length >= 2 && setShowSearchResults(true);
                            setShowRadiusSlider(false);
                        }}
                        onSubmitEditing={() => Keyboard.dismiss()}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <Pressable onPress={clearSearch}>
                            <Ionicons name="close-circle" size={20} color={colors.textWeak} />
                        </Pressable>
                    )}
                </Animated.View>

                <Pressable
                    style={styles.myLocationButton}
                    onPress={handleMyLocationPress}
                >
                    <Ionicons name={isFollowMode ? "navigate" : "locate"} size={24} color={colors.primary} />
                </Pressable>
            </View>

            {/* Search Results Dropdown */}
            {showSearchResults && (
                <View style={[styles.searchResultsContainer, { top: insets.top + spacing.sm + 56 }]}>
                    {isSearching ? (
                        <View style={styles.searchLoadingContainer}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.searchLoadingText}>{t('common.loading')}</Text>
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
                                </Pressable>
                            )}
                        />
                    ) : searchQuery.length >= 2 ? (
                        <View style={styles.searchLoadingContainer}>
                            <Ionicons name="search-outline" size={24} color={colors.textWeak} />
                            <Text style={styles.searchLoadingText}>{t('common.noResults')}</Text>
                        </View>
                    ) : null}
                </View>
            )}

            {/* First time hint toast */}
            {isFirstHint && !isDragging && centerLocation && !isNavigating && (
                <Animated.View style={[styles.hintToast, { opacity: hintOpacity }]}>
                    <Text style={styles.hintText}>{t('home.hint')}</Text>
                </Animated.View>
            )}

            {/* Navigation Panel (shown during navigation mode) */}
            {isNavigating ? (
                <NavigationPanel
                    onStopNavigation={() => {
                        if (activeAlarm) {
                            deactivateAlarm(activeAlarm.id);
                        }
                        stopNavigation();
                        stopTracking();
                    }}
                />
            ) : activeAlarm ? (
                <View style={[styles.bottomSheet, { paddingBottom: insets.bottom }]}>
                    <AlarmDashboard
                        alarm={activeAlarm}
                        memos={currentMemos}
                        distanceToTarget={distanceToTarget}
                        elapsedTime={elapsedTime}
                        onCancel={handleCancelAlarm}
                    />
                </View>
            ) : (
                /* Normal setup bottom sheet */
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
                                    {formatDistance(selectedRadius)}
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
                                        outputRange: [0, 120],
                                    }),
                                    opacity: sliderHeight,
                                    marginBottom: sliderHeight.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, spacing.xs],
                                    }),
                                    overflow: 'hidden',
                                }
                            ]}
                        >
                            <View style={styles.radiusSliderHeader}>
                                <Text style={styles.radiusSliderLabel}>{t('alarmSetup.radius')}</Text>
                                <Text style={styles.radiusSliderValue}>{formatDistance(selectedRadius)}</Text>
                            </View>
                            <Slider
                                style={styles.radiusSlider}
                                minimumValue={50}
                                maximumValue={2000}
                                step={50}
                                value={selectedRadius}
                                onValueChange={handleRadiusChange}
                                minimumTrackTintColor={colors.primary}
                                maximumTrackTintColor={`${colors.textWeak}50`}
                                thumbTintColor={colors.primary}
                            />
                            <View style={styles.radiusSliderLabels}>
                                <Text style={styles.radiusSliderMinMax}>50m</Text>
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
                            <Text style={styles.createButtonText}>{t('home.createAlarm')}</Text>
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
                                        t('home.deleteFavorite.title'),
                                        t('home.deleteFavorite.message', { name: fav.label }),
                                        [
                                            { text: t('common.cancel'), style: 'cancel' },
                                            { text: t('home.deleteFavorite.confirm'), style: 'destructive', onPress: () => deleteFavorite(fav.id) },
                                        ]
                                    );
                                }}
                            >
                                <Ionicons name={fav.icon as keyof typeof Ionicons.glyphMap} size={16} color={colors.primary} />
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
                                                radius: selectedRadius.toString(),
                                            },
                                        });
                                    }
                                }}
                            >
                                <Ionicons name="add" size={16} color={colors.textWeak} />
                                <Text style={styles.quickChipLabelAdd}>{t('home.favorites')}</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
        zIndex: 1000,
        overflow: 'hidden',
    },
    searchLoadingContainer: {
        padding: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    searchLoadingText: {
        ...typography.caption,
        color: colors.textMedium,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.sm,
        gap: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    searchResultIconContainer: {
        width: 32,
        height: 32,
        borderRadius: radius.full,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchResultTextContainer: {
        flex: 1,
        gap: 2,
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
    hintToast: {
        position: 'absolute',
        alignSelf: 'center',
        top: '40%',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        zIndex: 900,
    },
    hintText: {
        color: '#FFF',
        ...typography.caption,
        fontWeight: '600',
    },
    debugDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FF0000',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    bottomSheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        padding: spacing.md,
        paddingTop: spacing.sm,
        ...shadows.card,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
        gap: spacing.sm,
    },
    addressBarWrapper: {
        flex: 1,
    },
    radiusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        borderRadius: radius.full,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.border,
    },
    radiusChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    radiusChipText: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '700',
    },
    radiusChipTextActive: {
        color: colors.surface,
    },
    radiusSliderContainer: {
        backgroundColor: colors.background,
        borderRadius: radius.md,
        padding: spacing.md,
    },
    radiusSliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    radiusSliderLabel: {
        ...typography.caption,
        color: colors.textMedium,
        fontWeight: '600',
    },
    radiusSliderValue: {
        ...typography.heading,
        color: colors.primary,
        fontSize: 18,
    },
    radiusSlider: {
        width: '100%',
        height: 40,
    },
    radiusSliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    radiusSliderMinMax: {
        ...typography.caption,
        color: colors.textWeak,
        fontSize: 10,
    },
    createButton: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        gap: spacing.xs,
        height: 52,
        marginBottom: spacing.sm,
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
        fontSize: 16,
    },
    quickActionsCompact: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    quickChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        borderRadius: radius.md,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.border,
    },
    quickChipAdd: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        borderRadius: radius.md,
        gap: 6,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: colors.textWeak,
    },
    quickChipLabel: {
        ...typography.caption,
        color: colors.textStrong,
        fontWeight: '600',
    },
    quickChipLabelAdd: {
        ...typography.caption,
        color: colors.textWeak,
    },
});

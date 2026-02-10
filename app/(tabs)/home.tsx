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
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';
import { useAlarmStore } from '../../src/stores/alarmStore';
import { useLocationStore } from '../../src/stores/locationStore';
import { useFavoritePlaceStore } from '../../src/stores/favoritePlaceStore';
import { colors as defaultColors, typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../../src/styles/theme';
import CenterPinMarker from '../../src/components/map/CenterPinMarker';
import AddressBar from '../../src/components/map/AddressBar';
import NavigationPanel from '../../src/components/navigation/NavigationPanel';
import { isInKorea } from '../../src/services/location/searchService';
import { formatDistance } from '../../src/services/location/geofence';
import { mapDarkStyle } from '../../src/constants/mapDarkStyle';
import { useThemeStore } from '../../src/stores/themeStore';
import { useElapsedTime } from '../../src/hooks/useElapsedTime';
import { useMapPin } from '../../src/hooks/useMapPin';
import { useLocationSearch } from '../../src/hooks/useLocationSearch';

export default function Home() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const themeMode = useThemeStore((state) => state.mode);
    const systemScheme = useColorScheme();
    const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');
    const mapRef = useRef<MapView>(null);
    const searchBarOpacity = useRef(new Animated.Value(1)).current;

    const { activeAlarm, deactivateAlarm, loadMemos, currentMemos } = useAlarmStore();
    const { favorites, loadFavorites, deleteFavorite } = useFavoritePlaceStore();

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

    const {
        isDragging,
        centerLocation,
        addressInfo,
        isLoadingAddress,
        isAnimatingRef,
        isDraggingRef,
        handlers: pinHandlers,
        actions: pinActions,
    } = useMapPin({
        mapRef,
        initialLocation: currentLocation ? {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude
        } : null,
    });

    const {
        state: searchState,
        setQuery,
        clearSearch,
        showResults,
        hideResults,
        selectPlace,
        handleSearchSubmit,
    } = useLocationSearch({
        currentLocation: centerLocation,
        onPlaceSelected: (location, placeInfo) => {
            pinActions.moveToLocation(location, 400);
            pinActions.setAddressInfo({
                address: placeInfo.address,
                detail: placeInfo.name,
            });
        },
    });

    const elapsedTime = useElapsedTime(activeAlarm?.started_at ?? null);

    const sliderHeight = useRef(new Animated.Value(0)).current;
    const [selectedRadius, setSelectedRadius] = useState(100);
    const [isFirstHint, setIsFirstHint] = useState(false);
    const hintOpacity = useRef(new Animated.Value(1)).current;
    const [showRadiusSlider, setShowRadiusSlider] = useState(false);

    useEffect(() => {
        const init = async () => {
            await requestPermissions();
            const location = await getCurrentLocation();
            await loadFavorites();

            // Sync initial location to pin hook
            if (location) {
                const userPos = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                };
                pinActions.moveToLocation(userPos);
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

    // Fit map to route when navigation starts
    useEffect(() => {
        if (isNavigating && selectedRoute && mapRef.current) {
            // Add current user location to route coordinates for full path
            const allCoordinates = [...selectedRoute.coordinates];
            if (currentLocation) {
                allCoordinates.unshift({
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                });
            }

            // Fit map to show entire route
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
            pinActions.moveToLocation(newCenter, 0);
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

    // Animate radius slider height
    useEffect(() => {
        Animated.timing(sliderHeight, {
            toValue: showRadiusSlider ? 1 : 0,
            duration: 150, // Faster for better responsiveness
            useNativeDriver: false, // Height animation needs JS thread
        }).start();
    }, [showRadiusSlider]);

    // Watch user location in foreground when alarm is active (for smooth distance updates)
    useEffect(() => {
        if (!activeAlarm || isNavigating) return;

        let subscription: Location.LocationSubscription | null = null;

        const startWatching = async () => {
            try {
                subscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        distanceInterval: 5, // Update every 5 meters
                        timeInterval: 1000,
                    },
                    (location) => {
                        // Directly update store to reflect distance on UI immediately
                        useLocationStore.getState().updateLocation(location);
                    }
                );
            } catch (err) {
                console.warn('[Home] Failed to start foreground watcher:', err);
            }
        };

        startWatching();

        return () => {
            subscription?.remove();
        };
    }, [activeAlarm, isNavigating]);

    // Handle My Location button press
    const handleMyLocationPress = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Get current location
        const location = await getCurrentLocation();

        if (location) {
            const myLocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };
            pinActions.moveToLocation(myLocation, 500);
        } else {
            console.log('[Home] Could not get current location');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, [getCurrentLocation, pinActions]);

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
        let roundedValue;
        if (value <= 100) {
            // Round to nearest 10m
            roundedValue = Math.round(value / 10) * 10;
        } else {
            // Round to nearest 50m
            roundedValue = Math.round(value / 50) * 50;
        }
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

    // Jump to favorite location
    const handleJumpToFavorite = (favorite: { latitude: number; longitude: number; radius: number; label: string }) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Keyboard.dismiss();
        hideResults();

        const newLocation = {
            latitude: favorite.latitude,
            longitude: favorite.longitude,
        };

        // Animate map to location and geocode
        pinActions.moveToLocation(newLocation, 500);
        setSelectedRadius(favorite.radius);
    };

    const userLocation = currentLocation
        ? { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude }
        : { latitude: 37.5665, longitude: 126.9780 }; // Default to Seoul

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
                onPress={(e) => {
                    // Disable interactions during navigation
                    if (isNavigating) return;
                    Keyboard.dismiss();
                    if (searchState.isVisible) hideResults();
                    if (showRadiusSlider) {
                        setShowRadiusSlider(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                }}
                onPanDrag={isNavigating ? undefined : pinHandlers.handlePanDrag}
                onRegionChange={isNavigating ? undefined : pinHandlers.handleRegionChange}
                onRegionChangeComplete={isNavigating ? undefined : pinHandlers.handleRegionChangeComplete}
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
                {/* Active alarm marker */}
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
                        strokeColor={colors.error}
                        strokeWidth={2}
                        lineDashPattern={[5, 5]}
                    />
                )}
            </MapView>

            {/* Invisible overlay to close radius slider and keyboard - INSTANT response */}
            {(showRadiusSlider || searchState.isVisible) && (
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => {
                        Keyboard.dismiss();
                        setShowRadiusSlider(false);
                        hideResults();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                />
            )}

            {/* Center Pin (Fixed at screen center - hidden during navigation) */}
            {!isNavigating && !activeAlarm && <CenterPinMarker isDragging={isDragging} />}

            {/* Top Bar Container - Search + Location Button aligned */}
            <View style={[styles.topBarContainer, { top: insets.top + spacing.sm }]}>
                {/* Search Bar (fades during drag) */}
                <Animated.View style={[styles.searchBar, { opacity: searchBarOpacity }]}>
                    <Ionicons name="search" size={20} color={colors.textWeak} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('home.searchPlaceholder')}
                        placeholderTextColor={colors.textWeak}
                        value={searchState.query}
                        onChangeText={setQuery}
                        onFocus={() => {
                            showResults();
                            setShowRadiusSlider(false);
                        }}
                        onSubmitEditing={handleSearchSubmit}
                        returnKeyType="search"
                    />
                    {searchState.query.length > 0 && (
                        <Pressable onPress={clearSearch}>
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
            {searchState.isVisible && (
                <View style={[styles.searchResultsContainer, { top: insets.top + spacing.sm + 56 }]}>
                    {searchState.isSearching ? (
                        <View style={styles.searchLoadingContainer}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.searchLoadingText}>검색 중...</Text>
                        </View>
                    ) : searchState.results.length > 0 ? (
                        <FlatList
                            data={searchState.results}
                            keyExtractor={(item) => item.id}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => {
                                const isTopMatch = searchState.topMatch?.id === item.id;
                                return (
                                    <Pressable
                                        style={styles.searchResultItem}
                                        onPress={() => selectPlace(item)}
                                    >
                                        <View style={styles.searchResultIconContainer}>
                                            <Ionicons
                                                name={isTopMatch ? 'location' : 'location-outline'}
                                                size={20}
                                                color={isTopMatch ? colors.primary : colors.textMedium}
                                            />
                                        </View>
                                        <View style={styles.searchResultTextContainer}>
                                            <Text
                                                style={[
                                                    styles.searchResultName,
                                                    isTopMatch && styles.searchResultNameTop,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {item.name}
                                            </Text>
                                            <Text style={styles.searchResultAddress} numberOfLines={1}>
                                                {item.address}
                                            </Text>
                                        </View>
                                    </Pressable>
                                );
                            }}
                        />
                    ) : searchState.query.length >= 2 ? (
                        <View style={styles.searchLoadingContainer}>
                            <Ionicons name="search-outline" size={24} color={colors.textWeak} />
                            <Text style={styles.searchLoadingText}>{t('common.noResults', '검색 결과가 없습니다')}</Text>
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
                        // Deactivate alarm to remove red pin
                        if (activeAlarm) {
                            deactivateAlarm(activeAlarm.id);
                        }
                        stopNavigation();
                        stopTracking();
                    }}
                />
            ) : activeAlarm ? (
                /* Active Alarm Dashboard */
                <View style={[styles.bottomSheet, { paddingBottom: spacing.sm }]}>
                    {/* Alarm Title Row */}
                    <View style={styles.dashboardHeader}>
                        <View style={styles.dashboardTitleRow}>
                            <Ionicons name="navigate" size={20} color={colors.primary} />
                            <Text style={styles.dashboardTitle}>{activeAlarm.title}</Text>
                        </View>
                    </View>

                    {/* Prominent Distance Display */}
                    <View style={styles.distanceDisplayContainer}>
                        <Text style={styles.distanceValue}>
                            {distanceToTarget !== null ? formatDistance(distanceToTarget) : '--'}
                        </Text>
                        <Text style={styles.distanceLabel}>
                            {distanceToTarget !== null
                                ? t('alarmDashboard.distanceLabel')
                                : t('home.activeAlarm.calculating')}
                        </Text>
                    </View>

                    {/* Elapsed Time */}
                    <View style={styles.elapsedTimeContainer}>
                        <Ionicons name="time-outline" size={16} color={colors.textMedium} />
                        <Text style={styles.elapsedTimeText}>{elapsedTime}</Text>
                        <Text style={styles.elapsedTimeLabel}>{t('alarmDashboard.elapsedTime')}</Text>
                    </View>

                    {/* Checklist Preview */}
                    {currentMemos.length > 0 && (
                        <View style={styles.dashboardChecklist}>
                            <Text style={styles.dashboardChecklistTitle}>
                                {t('alarmDashboard.checklist')}
                            </Text>
                            {currentMemos.map((memo) => (
                                <View key={memo.id} style={styles.dashboardCheckItem}>
                                    <Ionicons
                                        name={memo.is_checked ? 'checkbox' : 'square-outline'}
                                        size={18}
                                        color={memo.is_checked ? colors.primary : colors.textWeak}
                                    />
                                    <Text style={[
                                        styles.dashboardCheckText,
                                        memo.is_checked && styles.dashboardCheckTextDone,
                                    ]}>
                                        {memo.content}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Cancel Alarm Button */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.cancelAlarmButton,
                            pressed && styles.cancelAlarmButtonPressed,
                        ]}
                        onPress={handleCancelAlarm}
                    >
                        <Text style={styles.cancelAlarmText}>{t('alarmDashboard.cancelAlarm')}</Text>
                    </Pressable>
                </View>
            ) : (
                /* Normal setup bottom sheet */
                <View style={[styles.bottomSheet, { paddingBottom: spacing.sm }]}>
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

                    {/* Supposed to be hide from UI */}
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
                                    padding: sliderHeight.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, spacing.md],
                                    }),
                                    overflow: 'hidden',
                                }
                            ]}
                        >
                            <View style={styles.radiusSliderHeader}>
                                <Text style={styles.radiusSliderLabel}>{t('alarmSetup.radius')}</Text>
                                <Text style={styles.radiusSliderValue}>{formatRadius(selectedRadius)}</Text>
                            </View>
                            <Slider
                                style={styles.radiusSlider}
                                minimumValue={50}
                                maximumValue={2000}
                                step={10}
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
    searchResultNameTop: {
        color: colors.primary,
        fontWeight: '700',
    },
    searchResultAddress: {
        ...typography.caption,
        color: colors.textMedium,
    },
    // Active Alarm Dashboard styles
    dashboardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    dashboardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        flex: 1,
    },
    dashboardTitle: {
        ...typography.heading,
        color: colors.textStrong,
    },
    distanceDisplayContainer: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
        marginBottom: spacing.xs,
    },
    distanceValue: {
        fontSize: 40,
        fontWeight: '800',
        color: colors.primary,
        lineHeight: 48,
    },
    distanceLabel: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 4,
    },
    elapsedTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    elapsedTimeText: {
        ...typography.body,
        color: colors.textMedium,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    elapsedTimeLabel: {
        ...typography.caption,
        color: colors.textWeak,
    },
    dashboardChecklist: {
        backgroundColor: colors.background,
        borderRadius: radius.md,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    dashboardChecklistTitle: {
        ...typography.caption,
        color: colors.textMedium,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    dashboardCheckItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: 4,
    },
    dashboardCheckText: {
        ...typography.body,
        color: colors.textStrong,
    },
    dashboardCheckTextDone: {
        color: colors.textWeak,
        textDecorationLine: 'line-through',
    },
    cancelAlarmButton: {
        borderWidth: 2,
        borderColor: colors.error,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    cancelAlarmButtonPressed: {
        opacity: 0.7,
        backgroundColor: `${colors.error}10`,
    },
    cancelAlarmText: {
        ...typography.body,
        color: colors.error,
        fontWeight: '700',
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
        paddingBottom: spacing.sm,
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
    //Animated.View Style
    radiusSliderContainer: {
        backgroundColor: colors.background,
        borderRadius: radius.md,
        // padding is animated inline
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

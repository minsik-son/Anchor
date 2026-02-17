/**
 * LocaAlert Home Screen
 * Map-First UI with Center Pin Location Picker
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Keyboard, Animated, FlatList, ActivityIndicator, Alert, Platform, useColorScheme, useWindowDimensions } from 'react-native';
import ReanimatedAnimated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { PROVIDER_GOOGLE, Circle, Marker, UrlTile, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAlarmStore } from '../../src/stores/alarmStore';
import { useLocationStore } from '../../src/stores/locationStore';
import { useFavoritePlaceStore } from '../../src/stores/favoritePlaceStore';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../../src/styles/theme';
import CenterPinMarker from '../../src/components/map/CenterPinMarker';
import NavigationPanel from '../../src/components/navigation/NavigationPanel';
import BottomSheetDashboard, {
    BOTTOM_SHEET_COLLAPSED,
} from '../../src/components/home/BottomSheetDashboard';
import { formatDistance, calculateDistance, isWithinRadius } from '../../src/services/location/geofence';
import { startTracking as startServiceTracking } from '../../src/services/location/locationService';
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
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 });

    // SharedValue for bottom sheet height - source of truth for both map and pin sync
    const bottomSheetAnimatedHeight = useSharedValue(BOTTOM_SHEET_COLLAPSED);

    // Animated style for map translation - syncs with pin movement
    const animatedMapStyle = useAnimatedStyle(() => {
        const sheetExpansion = bottomSheetAnimatedHeight.value - BOTTOM_SHEET_COLLAPSED;
        const verticalOffset = sheetExpansion / 2;
        return {
            flex: 1,
            transform: [{ translateY: -verticalOffset }],
        };
    });

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
        startTracking,
        distanceToTarget,
    } = useLocationStore();

    // Getter function for useMapPin (reads current value)
    const getBottomSheetHeight = useCallback(() => {
        return bottomSheetAnimatedHeight.value;
    }, []);

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
        mapHeight: mapLayout.height || screenHeight,
        screenWidth: mapLayout.width || screenWidth,
        getBottomSheetHeight,
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

    const [selectedRadius, setSelectedRadius] = useState(100);
    const [isFirstHint, setIsFirstHint] = useState(false);
    const hintOpacity = useRef(new Animated.Value(1)).current;
    const prevActiveAlarmRef = useRef<typeof activeAlarm>(activeAlarm);
    const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false);

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

            // ★ Restore active alarm on app restart
            const alarm = useAlarmStore.getState().activeAlarm;
            if (alarm) {
                console.log('[Home] Restoring active alarm:', alarm.title);
                const target = { latitude: alarm.latitude, longitude: alarm.longitude };

                // Check if already arrived
                if (location && isWithinRadius(
                    { latitude: location.coords.latitude, longitude: location.coords.longitude },
                    target,
                    alarm.radius,
                )) {
                    console.log('[Home] Already inside radius — triggering alarm');
                    router.push('/alarm-trigger');
                    return;
                }

                // Resume tracking (wrapped in try/catch to prevent app stuck on loading)
                const initialDistance = location
                    ? calculateDistance(
                        { latitude: location.coords.latitude, longitude: location.coords.longitude },
                        target,
                    )
                    : undefined;

                try {
                    await startTracking(target, alarm.radius, location ?? undefined);
                } catch (err) {
                    console.warn('[Home] Store tracking resume failed:', err);
                }

                try {
                    await startServiceTracking(target, alarm.radius, initialDistance);
                } catch (err) {
                    console.warn('[Home] Background tracking resume failed (Expo Go?):', err);
                }

                // Move pin to destination
                pinActions.moveToLocation(target, 400);
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

    // Auto-return to current location when alarm cycle ends
    useEffect(() => {
        const wasActive = prevActiveAlarmRef.current;
        prevActiveAlarmRef.current = activeAlarm;

        // Alarm just completed or cancelled → move map to current location
        if (wasActive && !activeAlarm) {
            handleMyLocationPress();
        }
    }, [activeAlarm, handleMyLocationPress]);

    // Fit map to show both current location and destination when alarm is active
    // For long distances, skip manual animateToRegion (unsafe delta) and use fitToCoordinates only
    useEffect(() => {
        if (!activeAlarm || !currentLocation || !mapRef.current || isNavigating) return;

        const userCoord = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
        };
        const destCoord = {
            latitude: activeAlarm.latitude,
            longitude: activeAlarm.longitude,
        };
        const coordinates = [userCoord, destCoord];

        // Calculate real geodesic distance
        const distance = calculateDistance(userCoord, destCoord);

        if (distance > 100_000) {
            // Long distance (>100km): use fitToCoordinates directly — it handles
            // globe-spanning coordinates safely without manual delta calculation
            mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: { top: 180, right: 100, bottom: BOTTOM_SHEET_COLLAPSED + 80, left: 100 },
                animated: true,
            });
            return;
        }

        // Normal distance: 2-step animation for smoother transition
        const midLat = (userCoord.latitude + destCoord.latitude) / 2;
        const midLng = (userCoord.longitude + destCoord.longitude) / 2;
        const latDiff = Math.abs(userCoord.latitude - destCoord.latitude);
        let lngDiff = Math.abs(userCoord.longitude - destCoord.longitude);
        if (lngDiff > 180) lngDiff = 360 - lngDiff;
        const delta = Math.max(latDiff, lngDiff) * 1.8;
        const safeDelta = Math.min(Math.max(delta, 0.02), 150);

        mapRef.current.animateToRegion(
            {
                latitude: midLat,
                longitude: midLng,
                latitudeDelta: safeDelta,
                longitudeDelta: safeDelta,
            },
            600,
        );

        setTimeout(() => {
            mapRef.current?.fitToCoordinates(coordinates, {
                edgePadding: { top: 180, right: 100, bottom: BOTTOM_SHEET_COLLAPSED + 80, left: 100 },
                animated: true,
            });
        }, 700);
    }, [activeAlarm?.id, !!currentLocation]);

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


    // Watch user location in foreground when alarm is active (for smooth distance updates)
    // For long-distance alarms (>50km), use relaxed intervals to save battery
    useEffect(() => {
        if (!activeAlarm || isNavigating) return;

        let subscription: Location.LocationSubscription | null = null;

        const startWatching = async () => {
            try {
                // Determine if this is a long-distance alarm
                const loc = useLocationStore.getState().currentLocation;
                let isLongRange = false;
                if (loc) {
                    const dist = calculateDistance(
                        { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
                        { latitude: activeAlarm.latitude, longitude: activeAlarm.longitude },
                    );
                    isLongRange = dist > 50_000;
                }

                subscription = await Location.watchPositionAsync(
                    {
                        accuracy: isLongRange ? Location.Accuracy.Balanced : Location.Accuracy.High,
                        distanceInterval: isLongRange ? 500 : 5,
                        timeInterval: isLongRange ? 30_000 : 1_000,
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
        setSelectedRadius(value);
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

    return (
        <View style={styles.container}>
            {/* Map - wrapped in Animated.View for smooth translation sync with pin */}
            <ReanimatedAnimated.View style={animatedMapStyle}>
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
                    onLayout={(event) => {
                        const { width, height } = event.nativeEvent.layout;
                        setMapLayout({ width, height });
                    }}
                    onPress={(e) => {
                        // Disable interactions during navigation
                        if (isNavigating) return;
                        Keyboard.dismiss();
                        if (searchState.isVisible) hideResults();
                        if (bottomSheetExpanded) {
                            setBottomSheetExpanded(false);
                        }
                    }}
                    onPanDrag={isNavigating ? undefined : pinHandlers.handlePanDrag}
                    onRegionChange={isNavigating ? undefined : pinHandlers.handleRegionChange}
                    onRegionChangeComplete={isNavigating ? undefined : pinHandlers.handleRegionChangeComplete}
                >
                {/* OSM Tile Overlay for Android */}
                {Platform.OS === 'android' && (
                    <UrlTile
                        urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
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
            </ReanimatedAnimated.View>

            {/* Invisible overlay to close search results and keyboard - INSTANT response */}
            {searchState.isVisible && (
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => {
                        Keyboard.dismiss();
                        hideResults();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                />
            )}

            {/* Center Pin (Fixed at screen center - hidden during navigation) */}
            {!isNavigating && !activeAlarm && (
                <CenterPinMarker
                    isDragging={isDragging}
                    bottomSheetHeight={bottomSheetAnimatedHeight}
                    mapHeight={mapLayout.height || screenHeight}
                />
            )}

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
                            setBottomSheetExpanded(false);
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
                    {searchState.showingRecent && searchState.recentDestinations.length > 0 ? (
                        /* Recent Destinations */
                        <View>
                            <View style={styles.recentHeader}>
                                <Ionicons name="time-outline" size={16} color={colors.textWeak} />
                                <Text style={styles.recentHeaderText}>{t('home.recentDestinations', '최근 목적지')}</Text>
                            </View>
                            <FlatList
                                data={searchState.recentDestinations}
                                keyExtractor={(item) => item.id}
                                keyboardShouldPersistTaps="handled"
                                scrollEnabled={false}
                                renderItem={({ item }) => (
                                    <Pressable
                                        style={styles.searchResultItem}
                                        onPress={() => selectPlace(item)}
                                    >
                                        <View style={styles.searchResultIconContainer}>
                                            <Ionicons
                                                name="time"
                                                size={20}
                                                color={colors.textMedium}
                                            />
                                        </View>
                                        <View style={styles.searchResultTextContainer}>
                                            <Text style={styles.searchResultName} numberOfLines={1}>
                                                {item.name}
                                            </Text>
                                        </View>
                                    </Pressable>
                                )}
                            />
                        </View>
                    ) : searchState.isSearching ? (
                        <View style={styles.searchLoadingContainer}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.searchLoadingText}>{t('home.searching')}</Text>
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
                /* Normal setup bottom sheet - Draggable */
                <BottomSheetDashboard
                    animatedHeight={bottomSheetAnimatedHeight}
                    centerLocation={centerLocation}
                    addressInfo={addressInfo}
                    isLoadingAddress={isLoadingAddress}
                    selectedRadius={selectedRadius}
                    onRadiusChange={handleRadiusChange}
                    favorites={favorites}
                    onFavoritePress={handleJumpToFavorite}
                    onFavoriteDelete={deleteFavorite}
                    onAddFavorite={() => {
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
                    onCreateAlarm={handleCreateAlarm}
                    expanded={bottomSheetExpanded}
                    onExpandedChange={setBottomSheetExpanded}
                />
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
    recentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.sm,
        paddingBottom: 4,
    },
    recentHeaderText: {
        ...typography.caption,
        color: colors.textWeak,
        fontWeight: '600',
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
});

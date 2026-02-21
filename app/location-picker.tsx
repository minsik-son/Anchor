/**
 * Location Picker Screen
 * Full-featured map picker for selecting a location
 * Reuses MapSearchBar, SearchResultsDropdown, CenterPinMarker, AddressBar
 * and hooks (useMapPin, useLocationSearch) from the main home screen
 */

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Platform,
    Keyboard,
    useWindowDimensions,
    LayoutChangeEvent,
    useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import { useSharedValue } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { useMapPin } from '../src/hooks/useMapPin';
import { useLocationSearch } from '../src/hooks/useLocationSearch';
import CenterPinMarker from '../src/components/map/CenterPinMarker';
import AddressBar from '../src/components/map/AddressBar';
import MapSearchBar from '../src/components/map/MapSearchBar';
import { SearchResultsDropdown } from '../src/components/map/SearchResultsDropdown';
import { useLocationPickerStore } from '../src/stores/locationPickerStore';
import { useThemeStore } from '../src/stores/themeStore';
import { useDistanceFormatter } from '../src/utils/distanceFormatter';
import { mapDarkStyle } from '../src/constants/mapDarkStyle';
import {
    RADIUS_STEPS,
    radiusToIndex,
    indexToRadius,
} from '../src/components/home/BottomSheetDashboard';
import {
    useThemeColors,
    ThemeColors,
    typography,
    spacing,
    radius,
    shadows,
} from '../src/styles/theme';

const SEOUL_DEFAULT = { latitude: 37.5665, longitude: 126.978 };

// Bottom panel height estimate for pin offset
const BOTTOM_PANEL_HEIGHT = 180;

export default function LocationPickerScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const themeMode = useThemeStore((state) => state.mode);
    const systemScheme = useColorScheme();
    const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');
    const { formatRadius, getRadiusLabels } = useDistanceFormatter();
    const radiusLabels = getRadiusLabels();

    // Refs & layout
    const mapRef = useRef<MapView>(null);
    const [mapLayout, setMapLayout] = useState({
        width: screenWidth,
        height: screenHeight * 0.65,
    });
    const [initialLocation, setInitialLocation] = useState(SEOUL_DEFAULT);

    // Radius state
    const [selectedRadius, setSelectedRadius] = useState(100);

    // Reanimated shared value (no bottom sheet, but CenterPinMarker expects it)
    const bottomSheetHeight = useSharedValue(BOTTOM_PANEL_HEIGHT);

    // Store
    const setPickedLocation = useLocationPickerStore((s) => s.setPickedLocation);

    // --- useMapPin ---
    const {
        isDragging,
        centerLocation,
        addressInfo,
        isLoadingAddress,
        handlers: pinHandlers,
        actions: pinActions,
    } = useMapPin({
        mapRef,
        initialLocation,
        mapHeight: mapLayout.height,
        screenWidth: mapLayout.width || screenWidth,
        getBottomSheetHeight: () => BOTTOM_PANEL_HEIGHT,
    });

    // --- useLocationSearch ---
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

    // Get initial location on mount
    useEffect(() => {
        (async () => {
            try {
                const last = await Location.getLastKnownPositionAsync();
                if (last) {
                    setInitialLocation({
                        latitude: last.coords.latitude,
                        longitude: last.coords.longitude,
                    });
                }
            } catch {
                // Use Seoul default
            }
        })();
    }, []);

    // Map layout measurement
    const handleMapLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setMapLayout({ width, height });
    }, []);

    // My location button
    const handleMyLocationPress = useCallback(async () => {
        try {
            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            pinActions.moveToLocation(
                { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
                400,
            );
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {
            // Silently fail
        }
    }, [pinActions]);

    // Radius change
    const handleRadiusChange = useCallback((value: number) => {
        setSelectedRadius(value);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    // Confirm
    const handleConfirm = useCallback(() => {
        if (!centerLocation) return;
        setPickedLocation({
            latitude: centerLocation.latitude,
            longitude: centerLocation.longitude,
            address: addressInfo.address || '',
            radius: selectedRadius,
        });
        router.back();
    }, [centerLocation, addressInfo.address, selectedRadius, setPickedLocation]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Map */}
            <View style={styles.mapContainer} onLayout={handleMapLayout}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                    initialRegion={{
                        ...initialLocation,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }}
                    showsUserLocation
                    showsMyLocationButton={false}
                    customMapStyle={isDarkMode ? mapDarkStyle : undefined}
                    userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
                    onPress={() => {
                        Keyboard.dismiss();
                        if (searchState.isVisible) hideResults();
                    }}
                    onPanDrag={pinHandlers.handlePanDrag}
                    onRegionChange={pinHandlers.handleRegionChange}
                    onRegionChangeComplete={pinHandlers.handleRegionChangeComplete}
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
                </MapView>

                {/* Center Pin */}
                <CenterPinMarker
                    isDragging={isDragging}
                    bottomSheetHeight={bottomSheetHeight}
                    mapHeight={mapLayout.height}
                />

                {/* Search overlay to dismiss */}
                {searchState.isVisible && (
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={() => {
                            Keyboard.dismiss();
                            hideResults();
                        }}
                    />
                )}
            </View>

            {/* Search Bar (absolute, top of map) */}
            <View style={[styles.searchBarContainer, { top: insets.top + spacing.sm }]}>
                <MapSearchBar
                    query={searchState.query}
                    onQueryChange={setQuery}
                    onFocus={showResults}
                    onClear={clearSearch}
                    onSubmit={handleSearchSubmit}
                    onMyLocationPress={handleMyLocationPress}
                />
            </View>

            {/* Search Results Dropdown (absolute, below search bar) */}
            <View style={[styles.searchResultsPositioner, { top: insets.top + spacing.sm + 56 }]}>
                <SearchResultsDropdown
                    isVisible={searchState.isVisible}
                    query={searchState.query}
                    results={searchState.results}
                    topMatch={searchState.topMatch}
                    isSearching={searchState.isSearching}
                    showingRecent={searchState.showingRecent}
                    recentDestinations={searchState.recentDestinations}
                    onSelectPlace={selectPlace}
                />
            </View>

            {/* Bottom Panel */}
            <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + spacing.sm }]}>
                {/* Address Bar */}
                <AddressBar
                    address={addressInfo.address}
                    detail={addressInfo.detail}
                    isLoading={isLoadingAddress}
                />

                {/* Radius Slider */}
                <View style={styles.radiusSection}>
                    <View style={styles.radiusHeader}>
                        <Text style={styles.radiusLabel}>{t('alarmSetup.radius')}</Text>
                        <Text style={styles.radiusValue}>{formatRadius(selectedRadius)}</Text>
                    </View>
                    <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={RADIUS_STEPS.length - 1}
                        step={1}
                        value={radiusToIndex(selectedRadius)}
                        onValueChange={(idx: number) => handleRadiusChange(indexToRadius(idx))}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={`${colors.textWeak}50`}
                        thumbTintColor={colors.primary}
                    />
                    <View style={styles.radiusLabels}>
                        <Text style={styles.radiusMinMax}>{radiusLabels.min}</Text>
                        <Text style={styles.radiusMinMax}>{radiusLabels.max}</Text>
                    </View>
                </View>

                {/* Confirm Button */}
                <Pressable
                    style={({ pressed }) => [
                        styles.confirmButton,
                        pressed && styles.confirmButtonPressed,
                        !centerLocation && styles.confirmButtonDisabled,
                    ]}
                    onPress={handleConfirm}
                    disabled={!centerLocation}
                >
                    <Text style={styles.confirmButtonText}>
                        {t('locationPicker.confirm')}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

const createStyles = (colors: ThemeColors) =>
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
        searchBarContainer: {
            position: 'absolute',
            left: spacing.sm,
            right: spacing.sm,
            zIndex: 100,
        },
        searchResultsPositioner: {
            position: 'absolute',
            left: spacing.sm,
            right: spacing.sm,
            zIndex: 1000,
        },
        bottomPanel: {
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            gap: spacing.sm,
            ...shadows.card,
        },
        radiusSection: {
            backgroundColor: colors.background,
            borderRadius: radius.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
        },
        radiusHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.xs,
        },
        radiusLabel: {
            ...typography.caption,
            color: colors.textMedium,
            fontWeight: '600',
        },
        radiusValue: {
            ...typography.heading,
            color: colors.primary,
            fontSize: 18,
        },
        slider: {
            width: '100%',
            height: 40,
        },
        radiusLabels: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 10,
        },
        radiusMinMax: {
            ...typography.caption,
            color: colors.textWeak,
            fontSize: 10,
        },
        confirmButton: {
            backgroundColor: colors.primary,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            height: 52,
            ...shadows.button,
        },
        confirmButtonPressed: {
            opacity: 0.9,
            transform: [{ scale: 0.98 }],
        },
        confirmButtonDisabled: {
            backgroundColor: colors.textWeak,
            opacity: 0.5,
        },
        confirmButtonText: {
            ...typography.body,
            color: colors.surface,
            fontWeight: '700',
            fontSize: 16,
        },
    });

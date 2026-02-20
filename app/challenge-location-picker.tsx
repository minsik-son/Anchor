/**
 * Challenge Location Picker
 * Search and select a place, or tap the map to pick a location
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator, Platform, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE, MapPressEvent } from 'react-native-maps';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';
import { useLocationSearch } from '../src/hooks/useLocationSearch';
import { SearchResult } from '../src/services/location/searchService';

const DEFAULT_DELTA = 0.01;

export default function ChallengeLocationPicker() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const mapRef = useRef<MapView>(null);

    const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [selectedPin, setSelectedPin] = useState<{ latitude: number; longitude: number } | null>(null);
    const [selectedPlaceName, setSelectedPlaceName] = useState<string | null>(null);
    const [selectedPlaceAddress, setSelectedPlaceAddress] = useState<string | null>(null);
    const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setCurrentLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
            } catch {
                // Fallback to Seoul
                setCurrentLocation({ latitude: 37.5665, longitude: 126.9780 });
            }
        })();
    }, []);

    const handlePlaceSelected = useCallback((coords: { latitude: number; longitude: number }, placeInfo: SearchResult) => {
        router.back();
        setTimeout(() => {
            router.setParams({
                placeName: placeInfo.name,
                placeAddress: placeInfo.address,
                placeLatitude: String(coords.latitude),
                placeLongitude: String(coords.longitude),
            });
        }, 100);
    }, []);

    const { state, setQuery, clearSearch, selectPlace } = useLocationSearch({
        currentLocation,
        onPlaceSelected: handlePlaceSelected,
    });

    const handleResultPress = useCallback(async (result: SearchResult) => {
        const coords = await selectPlace(result);
        if (coords) {
            router.navigate({
                pathname: '/challenge-create',
                params: {
                    placeName: result.name,
                    placeAddress: result.address,
                    placeLatitude: String(coords.latitude),
                    placeLongitude: String(coords.longitude),
                },
            });
        }
    }, [selectPlace]);

    const handleMapPress = useCallback(async (event: MapPressEvent) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        Keyboard.dismiss();
        setSelectedPin({ latitude, longitude });
        setSelectedPlaceName(null);
        setSelectedPlaceAddress(null);
        setIsReverseGeocoding(true);

        try {
            const results = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (results && results.length > 0) {
                const geocode = results[0];
                const name = geocode.name || geocode.street || t('challengeCreate.location.selectedLocation');
                const addressParts = [geocode.district, geocode.city, geocode.region].filter(Boolean);
                const address = addressParts.join(' ');
                setSelectedPlaceName(name);
                setSelectedPlaceAddress(address || null);
            } else {
                setSelectedPlaceName(t('challengeCreate.location.selectedLocation'));
            }
        } catch {
            setSelectedPlaceName(t('challengeCreate.location.selectedLocation'));
        } finally {
            setIsReverseGeocoding(false);
        }
    }, [t]);

    const handleSelectPinLocation = useCallback(() => {
        if (!selectedPin || !selectedPlaceName) return;
        router.navigate({
            pathname: '/challenge-create',
            params: {
                placeName: selectedPlaceName,
                placeAddress: selectedPlaceAddress || '',
                placeLatitude: String(selectedPin.latitude),
                placeLongitude: String(selectedPin.longitude),
            },
        });
    }, [selectedPin, selectedPlaceName, selectedPlaceAddress]);

    const showMap = state.results.length === 0;

    const renderResult = useCallback(({ item }: { item: SearchResult }) => (
        <Pressable style={styles.resultItem} onPress={() => handleResultPress(item)}>
            <Ionicons name="location-outline" size={20} color={colors.textMedium} />
            <View style={styles.resultContent}>
                <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.resultAddress} numberOfLines={1}>{item.address}</Text>
            </View>
        </Pressable>
    ), [styles, colors, handleResultPress]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('challengeCreate.location.searchTitle')}</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Ionicons name="search" size={20} color={colors.textWeak} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('challengeCreate.location.searchPlaceholder')}
                        placeholderTextColor={colors.textWeak}
                        value={state.query}
                        onChangeText={setQuery}
                        autoFocus
                        returnKeyType="search"
                    />
                    {state.query.length > 0 && (
                        <Pressable onPress={clearSearch} hitSlop={8}>
                            <Ionicons name="close-circle" size={20} color={colors.textWeak} />
                        </Pressable>
                    )}
                </View>
            </View>

            {/* Loading */}
            {state.isSearching && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            )}

            {/* Search Results */}
            {state.results.length > 0 && (
                <FlatList
                    data={state.results}
                    keyExtractor={(item) => item.id}
                    renderItem={renderResult}
                    contentContainerStyle={styles.resultList}
                    keyboardShouldPersistTaps="handled"
                    style={styles.resultListContainer}
                />
            )}

            {/* Map + Pin Selection */}
            {showMap && currentLocation && (
                <View style={styles.mapContainer}>
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                        initialRegion={{
                            latitude: currentLocation.latitude,
                            longitude: currentLocation.longitude,
                            latitudeDelta: DEFAULT_DELTA,
                            longitudeDelta: DEFAULT_DELTA,
                        }}
                        onPress={handleMapPress}
                        showsUserLocation
                        showsMyLocationButton
                    >
                        {selectedPin && (
                            <Marker
                                coordinate={selectedPin}
                                pinColor={colors.primary}
                            />
                        )}
                    </MapView>

                    {/* Map hint */}
                    {!selectedPin && (
                        <View style={styles.mapHintContainer}>
                            <Text style={styles.mapHintText}>
                                {t('challengeCreate.location.mapSelectHint')}
                            </Text>
                        </View>
                    )}

                    {/* Selected location card */}
                    {selectedPin && (
                        <View style={[styles.selectedLocationCard, { paddingBottom: insets.bottom + spacing.sm }]}>
                            <View style={styles.selectedLocationInfo}>
                                <Ionicons name="location" size={20} color={colors.primary} />
                                <View style={styles.selectedLocationText}>
                                    {isReverseGeocoding ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                        <>
                                            <Text style={styles.selectedLocationName} numberOfLines={1}>
                                                {selectedPlaceName || '...'}
                                            </Text>
                                            {selectedPlaceAddress && (
                                                <Text style={styles.selectedLocationAddress} numberOfLines={1}>
                                                    {selectedPlaceAddress}
                                                </Text>
                                            )}
                                        </>
                                    )}
                                </View>
                            </View>
                            <Pressable
                                style={[
                                    styles.selectButton,
                                    (!selectedPlaceName || isReverseGeocoding) && styles.selectButtonDisabled,
                                ]}
                                onPress={handleSelectPinLocation}
                                disabled={!selectedPlaceName || isReverseGeocoding}
                            >
                                <Text style={[
                                    styles.selectButtonText,
                                    (!selectedPlaceName || isReverseGeocoding) && styles.selectButtonTextDisabled,
                                ]}>
                                    {t('challengeCreate.location.selectThisLocation')}
                                </Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            )}

            {/* No results message */}
            {state.query.length >= 2 && !state.isSearching && state.results.length === 0 && (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>{t('common.noResults')}</Text>
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
    searchContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        gap: spacing.xs,
    },
    searchInput: {
        flex: 1,
        ...typography.body,
        color: colors.textStrong,
        paddingVertical: 12,
    },
    loadingContainer: {
        padding: spacing.md,
        alignItems: 'center',
    },
    resultListContainer: {
        flex: 1,
    },
    resultList: {
        paddingHorizontal: spacing.md,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        gap: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    resultContent: {
        flex: 1,
    },
    resultName: {
        ...typography.body,
        fontWeight: '600',
        color: colors.textStrong,
    },
    resultAddress: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 2,
    },
    emptyContainer: {
        padding: spacing.lg,
        alignItems: 'center',
    },
    emptyText: {
        ...typography.body,
        color: colors.textWeak,
    },
    // Map styles
    mapContainer: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    mapHintContainer: {
        position: 'absolute',
        top: spacing.md,
        left: spacing.md,
        right: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        alignItems: 'center',
        ...shadows.card,
    },
    mapHintText: {
        ...typography.caption,
        color: colors.textMedium,
    },
    // Selected location card
    selectedLocationCard: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: spacing.md,
        ...shadows.card,
    },
    selectedLocationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    selectedLocationText: {
        flex: 1,
    },
    selectedLocationName: {
        ...typography.body,
        fontWeight: '600',
        color: colors.textStrong,
    },
    selectedLocationAddress: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 2,
    },
    selectButton: {
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
    },
    selectButtonDisabled: {
        backgroundColor: colors.border,
    },
    selectButtonText: {
        ...typography.body,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    selectButtonTextDisabled: {
        color: colors.textWeak,
    },
});

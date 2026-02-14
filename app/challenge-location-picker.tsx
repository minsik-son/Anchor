/**
 * Challenge Location Picker
 * Search and select a place for a challenge using the existing search service
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';
import { useLocationSearch } from '../src/hooks/useLocationSearch';
import { SearchResult } from '../src/services/location/searchService';

export default function ChallengeLocationPicker() {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

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
        // Use setTimeout to ensure navigation params are set after back
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

            {/* Results */}
            {state.isSearching && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            )}

            <FlatList
                data={state.results}
                keyExtractor={(item) => item.id}
                renderItem={renderResult}
                contentContainerStyle={styles.resultList}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                    state.query.length >= 2 && !state.isSearching ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>{t('common.noResults')}</Text>
                        </View>
                    ) : null
                }
            />
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
});

/**
 * SearchResultsDropdown Component
 * Reusable search results list with recent destinations support
 * Extracted from home.tsx for reuse in location-picker
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors, ThemeColors, typography, spacing, radius, shadows } from '../../styles/theme';
import { SearchResult } from '../../services/location/searchService';

// =============================================================================
// Types
// =============================================================================

interface SearchResultsDropdownProps {
    isVisible: boolean;
    query: string;
    results: SearchResult[];
    topMatch: SearchResult | null;
    isSearching: boolean;
    showingRecent: boolean;
    recentDestinations: SearchResult[];
    onSelectPlace: (place: SearchResult) => void;
}

// =============================================================================
// Component
// =============================================================================

export function SearchResultsDropdown({
    isVisible,
    query,
    results,
    topMatch,
    isSearching,
    showingRecent,
    recentDestinations,
    onSelectPlace,
}: SearchResultsDropdownProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    if (!isVisible) {
        return null;
    }

    // Show recent destinations
    if (showingRecent && recentDestinations.length > 0) {
        return (
            <View style={styles.searchResultsContainer}>
                <View style={styles.recentHeader}>
                    <Ionicons name="time-outline" size={16} color={colors.textWeak} />
                    <Text style={styles.recentHeaderText}>{t('home.recentDestinations', '최근 목적지')}</Text>
                </View>
                <FlatList
                    data={recentDestinations}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                        <Pressable
                            style={styles.searchResultItem}
                            onPress={() => onSelectPlace(item)}
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
        );
    }

    // Show loading spinner
    if (isSearching) {
        return (
            <View style={styles.searchResultsContainer}>
                <View style={styles.searchLoadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.searchLoadingText}>{t('home.searching')}</Text>
                </View>
            </View>
        );
    }

    // Show search results
    if (results.length > 0) {
        return (
            <View style={styles.searchResultsContainer}>
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                        const isTopMatch = topMatch?.id === item.id;
                        return (
                            <Pressable
                                style={styles.searchResultItem}
                                onPress={() => onSelectPlace(item)}
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
            </View>
        );
    }

    // Show "no results" message
    if (query.length >= 2) {
        return (
            <View style={styles.searchResultsContainer}>
                <View style={styles.searchLoadingContainer}>
                    <Ionicons name="search-outline" size={24} color={colors.textWeak} />
                    <Text style={styles.searchLoadingText}>{t('common.noResults', '검색 결과가 없습니다')}</Text>
                </View>
            </View>
        );
    }

    // Don't render anything
    return null;
}

// =============================================================================
// Styles
// =============================================================================

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        searchResultsContainer: {
            maxHeight: 300,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            ...shadows.card,
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
    });
}

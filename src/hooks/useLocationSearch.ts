/**
 * useLocationSearch Hook
 *
 * Modular search logic with caching, result ranking, and top match highlighting.
 * Delegates API calls to searchService.ts service.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
    SearchResult,
    debouncedSearch,
    cancelPendingSearch,
    getGooglePlaceDetails,
    resetSessionToken,
} from '../services/location/searchService';

// =============================================================================
// Types
// =============================================================================

interface Coords {
    latitude: number;
    longitude: number;
}

interface SearchConfig {
    debounceMs?: number;
    minQueryLength?: number;
    cacheTTL?: number;
    maxCacheEntries?: number;
}

interface UseLocationSearchProps {
    currentLocation: Coords | null;
    config?: SearchConfig;
    onPlaceSelected?: (location: Coords, placeInfo: SearchResult) => void;
}

interface SearchState {
    query: string;
    results: SearchResult[];
    isSearching: boolean;
    isVisible: boolean;
    topMatch: SearchResult | null;
}

interface UseLocationSearchReturn {
    state: SearchState;
    setQuery: (query: string) => void;
    clearSearch: () => void;
    showResults: () => void;
    hideResults: () => void;
    selectPlace: (result: SearchResult) => Promise<Coords | null>;
    handleSearchSubmit: () => void;
}

// =============================================================================
// Cache Implementation
// =============================================================================

interface CacheEntry {
    results: SearchResult[];
    timestamp: number;
}

class SearchResultCache {
    private cache: Map<string, CacheEntry> = new Map();
    private ttl: number;
    private maxEntries: number;

    constructor(ttlMs: number = 5 * 60 * 1000, maxEntries: number = 50) {
        this.ttl = ttlMs;
        this.maxEntries = maxEntries;
    }

    /**
     * Generate cache key with location bucket (~10km regions)
     */
    private generateKey(query: string, location: Coords | null): string {
        if (!location) {
            return query.toLowerCase().trim();
        }
        const latBucket = Math.round(location.latitude * 10) / 10;
        const lngBucket = Math.round(location.longitude * 10) / 10;
        return `${query.toLowerCase().trim()}|${latBucket}|${lngBucket}`;
    }

    get(query: string, location: Coords | null): SearchResult[] | null {
        const key = this.generateKey(query, location);
        const entry = this.cache.get(key);

        if (!entry) return null;

        // Check if expired
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.results;
    }

    set(query: string, location: Coords | null, results: SearchResult[]): void {
        const key = this.generateKey(query, location);

        // LRU eviction
        if (this.cache.size >= this.maxEntries) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(key, {
            results,
            timestamp: Date.now(),
        });
    }

    clear(): void {
        this.cache.clear();
    }
}

// =============================================================================
// Result Ranking
// =============================================================================

function rankResults(results: SearchResult[], query: string): SearchResult[] {
    const normalizedQuery = query.toLowerCase().trim();

    return [...results].sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        // Priority 1: Exact match
        const aExact = aName === normalizedQuery;
        const bExact = bName === normalizedQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Priority 2: Starts with query
        const aStarts = aName.startsWith(normalizedQuery);
        const bStarts = bName.startsWith(normalizedQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Priority 3: Source preference (KAKAO > APPLE > GOOGLE > EXPO)
        const sourceOrder = { KAKAO: 0, APPLE: 1, GOOGLE: 2, EXPO: 3 };
        const aOrder = sourceOrder[a.source] ?? 3;
        const bOrder = sourceOrder[b.source] ?? 3;
        if (aOrder !== bOrder) return aOrder - bOrder;

        // Priority 4: Keep API order (distance-based)
        return 0;
    });
}

function findTopMatch(results: SearchResult[], query: string): SearchResult | null {
    if (results.length === 0) return null;

    const normalizedQuery = query.toLowerCase().trim();
    const ranked = rankResults(results, query);

    // Top match is the first result if it's a strong match
    const top = ranked[0];
    const topName = top.name.toLowerCase();

    // Consider it a "top match" if exact or starts with query
    if (topName === normalizedQuery || topName.startsWith(normalizedQuery)) {
        return top;
    }

    return null;
}

// =============================================================================
// Hook Implementation
// =============================================================================

const DEFAULT_CONFIG: Required<SearchConfig> = {
    debounceMs: 350,
    minQueryLength: 2,
    cacheTTL: 5 * 60 * 1000,
    maxCacheEntries: 50,
};

export function useLocationSearch({
    currentLocation,
    config = {},
    onPlaceSelected,
}: UseLocationSearchProps): UseLocationSearchReturn {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    const [query, setQueryState] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [topMatch, setTopMatch] = useState<SearchResult | null>(null);

    const cacheRef = useRef(
        new SearchResultCache(mergedConfig.cacheTTL, mergedConfig.maxCacheEntries)
    );

    // Default location for search (Seoul fallback)
    const searchLocation = useMemo(() => {
        return currentLocation || { latitude: 37.5665, longitude: 126.9780 };
    }, [currentLocation]);

    const setQuery = useCallback(
        (newQuery: string) => {
            setQueryState(newQuery);

            if (newQuery.length < mergedConfig.minQueryLength) {
                setResults([]);
                setTopMatch(null);
                setIsVisible(false);
                cancelPendingSearch();
                return;
            }

            // Check cache first
            const cachedResults = cacheRef.current.get(newQuery, currentLocation);
            if (cachedResults) {
                const ranked = rankResults(cachedResults, newQuery);
                setResults(ranked);
                setTopMatch(findTopMatch(ranked, newQuery));
                setIsVisible(true);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            setIsVisible(true);

            debouncedSearch(
                {
                    query: newQuery,
                    currentLocation: searchLocation,
                    language: 'ko',
                },
                (searchResults) => {
                    // Cache results
                    cacheRef.current.set(newQuery, currentLocation, searchResults);

                    // Rank and set
                    const ranked = rankResults(searchResults, newQuery);
                    setResults(ranked);
                    setTopMatch(findTopMatch(ranked, newQuery));
                    setIsSearching(false);
                },
                mergedConfig.debounceMs
            );
        },
        [currentLocation, searchLocation, mergedConfig.minQueryLength, mergedConfig.debounceMs]
    );

    const clearSearch = useCallback(() => {
        setQueryState('');
        setResults([]);
        setTopMatch(null);
        setIsVisible(false);
        setIsSearching(false);
        cancelPendingSearch();
    }, []);

    const showResults = useCallback(() => {
        if (query.length >= mergedConfig.minQueryLength) {
            setIsVisible(true);
        }
    }, [query, mergedConfig.minQueryLength]);

    const hideResults = useCallback(() => {
        setIsVisible(false);
    }, []);

    const selectPlace = useCallback(
        async (result: SearchResult): Promise<Coords | null> => {
            setIsVisible(false);
            setQueryState('');
            Keyboard.dismiss();

            let finalLocation: Coords | null = null;

            // Kakao, Apple, and Expo results have coordinates directly
            if (result.latitude !== undefined && result.longitude !== undefined) {
                finalLocation = {
                    latitude: result.latitude,
                    longitude: result.longitude,
                };
            }
            // Google results need an additional API call
            else if (result.source === 'GOOGLE' && result.placeId) {
                const coords = await getGooglePlaceDetails(result.placeId);
                if (coords) {
                    finalLocation = coords;
                }
            }

            if (!finalLocation) {
                console.error('[useLocationSearch] Could not get coordinates for selected place');
                return null;
            }

            // Reset session token after selection (Google billing optimization)
            resetSessionToken();

            // Haptic feedback
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Callback
            onPlaceSelected?.(finalLocation, result);

            return finalLocation;
        },
        [onPlaceSelected]
    );

    const handleSearchSubmit = useCallback(() => {
        Keyboard.dismiss();
    }, []);

    const state: SearchState = {
        query,
        results,
        isSearching,
        isVisible,
        topMatch,
    };

    return {
        state,
        setQuery,
        clearSearch,
        showResults,
        hideResults,
        selectPlace,
        handleSearchSubmit,
    };
}

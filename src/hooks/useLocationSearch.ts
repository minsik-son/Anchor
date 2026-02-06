/**
 * useLocationSearch Hook
 * Encapsulates place search logic extracted from home.tsx
 */

import { useState, useCallback } from 'react';
import {
    PlaceResult,
    debouncedSearchPlaces,
    cancelPendingSearch,
    getGooglePlaceDetails,
    resetSessionToken,
} from '../services/placeSearch';

interface UseLocationSearchParams {
    centerLocation: { latitude: number; longitude: number } | null;
    defaultLocation: { latitude: number; longitude: number };
}

export interface SearchResultInfo {
    location: { latitude: number; longitude: number };
    address: string;
    name: string;
}

interface UseLocationSearchReturn {
    searchQuery: string;
    searchResults: PlaceResult[];
    isSearching: boolean;
    showSearchResults: boolean;
    setShowSearchResults: (show: boolean) => void;
    handleSearch: (query: string) => void;
    resolveSearchResult: (result: PlaceResult) => Promise<SearchResultInfo | null>;
    clearSearch: () => void;
}

export function useLocationSearch({
    centerLocation,
    defaultLocation,
}: UseLocationSearchParams): UseLocationSearchReturn {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);

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

    const resolveSearchResult = useCallback(async (result: PlaceResult): Promise<SearchResultInfo | null> => {
        let finalLocation: { latitude: number; longitude: number } | null = null;

        if (result.latitude !== undefined && result.longitude !== undefined) {
            finalLocation = {
                latitude: result.latitude,
                longitude: result.longitude,
            };
        } else if (result.source === 'GOOGLE' && result.placeId) {
            const coords = await getGooglePlaceDetails(result.placeId, '');
            if (coords) {
                finalLocation = coords;
            }
        }

        if (!finalLocation) {
            console.error('[useLocationSearch] Could not get coordinates for selected place');
            return null;
        }

        resetSessionToken();

        return {
            location: finalLocation,
            address: result.address,
            name: result.name,
        };
    }, []);

    const clearSearch = useCallback(() => {
        setSearchQuery('');
        setSearchResults([]);
        setShowSearchResults(false);
        cancelPendingSearch();
    }, []);

    return {
        searchQuery,
        searchResults,
        isSearching,
        showSearchResults,
        setShowSearchResults,
        handleSearch,
        resolveSearchResult,
        clearSearch,
    };
}

/**
 * Unified Search Service
 *
 * Platform-aware search with prioritized API selection:
 * 1. Korea → Kakao Maps API
 * 2. iOS (Global) → Apple MapKit JS API
 * 3. Android/Fallback → OSM Nominatim (free, no API key)
 * 4. Final Fallback → Expo Location geocoding
 */

import { Platform } from 'react-native';
import * as Location from 'expo-location';

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface SearchResult {
    id: string;
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
    placeId?: string;
    source: 'KAKAO' | 'APPLE' | 'OSM' | 'EXPO';
    relevanceScore?: number;
}

export interface SearchOptions {
    query: string;
    currentLocation: { latitude: number; longitude: number };
    language?: string;
    limit?: number;
}

export interface SearchConfig {
    kakaoApiKey?: string;
    appleMapKitToken?: string;
}

// =============================================================================
// API Keys Configuration
//
// SECURITY NOTE: EXPO_PUBLIC_ prefixed keys are embedded in the JS bundle.
// Protect these keys by configuring platform restrictions:
//   - Kakao: Kakao Developers Console → App Settings → Platform → iOS Bundle ID (com.mnisik.app)
//   - Apple: Managed via short-lived JWT tokens (inherently safer)
// =============================================================================

const config: SearchConfig = {
    kakaoApiKey: process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY || '',
    appleMapKitToken: process.env.EXPO_PUBLIC_APPLE_MAPKIT_TOKEN || '',
};

// =============================================================================
// Geofencing - Korea Detection
// =============================================================================

export function isInKorea(lat: number, lon: number): boolean {
    return lat >= 33.0 && lat <= 38.9 && lon >= 124.5 && lon <= 132.0;
}

// =============================================================================
// Kakao Local Search API (Korea)
// =============================================================================

interface KakaoDocument {
    id: string;
    place_name: string;
    address_name: string;
    road_address_name?: string;
    x: string;
    y: string;
    category_name?: string;
}

interface KakaoSearchResponse {
    documents: KakaoDocument[];
    meta: { total_count: number; pageable_count: number; is_end: boolean };
}

async function searchKakao(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!config.kakaoApiKey) {
        console.warn('[SearchService] Kakao API key not configured');
        return [];
    }

    try {
        const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=${limit}`;
        const response = await fetch(url, {
            headers: { Authorization: `KakaoAK ${config.kakaoApiKey}` },
        });

        if (!response.ok) {
            throw new Error(`Kakao API error: ${response.status}`);
        }

        const json: KakaoSearchResponse = await response.json();

        return json.documents.map((item, index) => ({
            id: item.id,
            name: item.place_name,
            address: item.road_address_name || item.address_name,
            latitude: parseFloat(item.y),
            longitude: parseFloat(item.x),
            source: 'KAKAO' as const,
            relevanceScore: 100 - index,
        })).filter(r => !isNaN(r.latitude!) && !isNaN(r.longitude!));
    } catch (error) {
        console.error('[SearchService] Kakao search error:', error);
        return [];
    }
}

// =============================================================================
// Apple MapKit JS API (iOS Global)
// =============================================================================

interface AppleSearchResult {
    completionUrl?: string;
    displayLines: string[];
    location?: { latitude: number; longitude: number };
    structuredAddress?: {
        administrativeArea?: string;
        locality?: string;
        thoroughfare?: string;
        subThoroughfare?: string;
    };
}

interface AppleAutocompleteResponse {
    results: AppleSearchResult[];
}

interface AppleSearchResponse {
    results: Array<{
        id: string;
        name: string;
        formattedAddress: string;
        coordinate: { latitude: number; longitude: number };
    }>;
}

/**
 * Search using Apple MapKit JS API
 * Provides native iOS search experience with MKLocalSearch-equivalent functionality
 */
async function searchApple(
    query: string,
    location: { latitude: number; longitude: number },
    language: string = 'en',
    limit: number = 10
): Promise<SearchResult[]> {
    if (!config.appleMapKitToken) {
        // Fallback to expo-location geocoding on iOS without Apple token
        return searchExpoFallback(query, limit);
    }

    try {
        // Apple MapKit JS search endpoint
        const searchParams = new URLSearchParams({
            q: query,
            lang: language,
            searchLocation: `${location.latitude},${location.longitude}`,
            searchRegionSpan: '0.5,0.5', // ~50km search radius
        });

        const response = await fetch(
            `https://maps-api.apple.com/v1/search?${searchParams.toString()}`,
            {
                headers: {
                    Authorization: `Bearer ${config.appleMapKitToken}`,
                },
            }
        );

        if (!response.ok) {
            if (response.status === 401) {
                console.warn('[SearchService] Apple MapKit token invalid or expired');
            }
            throw new Error(`Apple MapKit API error: ${response.status}`);
        }

        const json: AppleSearchResponse = await response.json();

        return json.results.slice(0, limit).map((item, index) => ({
            id: item.id || `apple-${index}`,
            name: item.name,
            address: item.formattedAddress,
            latitude: item.coordinate.latitude,
            longitude: item.coordinate.longitude,
            source: 'APPLE' as const,
            relevanceScore: 100 - index,
        })).filter(r => r.latitude != null && r.longitude != null && !isNaN(r.latitude) && !isNaN(r.longitude));
    } catch (error) {
        console.error('[SearchService] Apple search error:', error);
        // Fallback to expo-location on error
        return searchExpoFallback(query, limit);
    }
}

/**
 * Apple MapKit JS Autocomplete
 * Provides real-time suggestions as user types
 */
async function autocompleteApple(
    query: string,
    location: { latitude: number; longitude: number },
    language: string = 'en',
    limit: number = 5
): Promise<SearchResult[]> {
    if (!config.appleMapKitToken) {
        return [];
    }

    try {
        const searchParams = new URLSearchParams({
            q: query,
            lang: language,
            searchLocation: `${location.latitude},${location.longitude}`,
        });

        const response = await fetch(
            `https://maps-api.apple.com/v1/searchAutocomplete?${searchParams.toString()}`,
            {
                headers: {
                    Authorization: `Bearer ${config.appleMapKitToken}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Apple Autocomplete error: ${response.status}`);
        }

        const json: AppleAutocompleteResponse = await response.json();

        return json.results.slice(0, limit).map((item, index) => ({
            id: `apple-auto-${index}`,
            name: item.displayLines[0] || query,
            address: item.displayLines.slice(1).join(', ') || '',
            latitude: item.location?.latitude,
            longitude: item.location?.longitude,
            source: 'APPLE' as const,
            relevanceScore: 100 - index,
        }));
    } catch (error) {
        console.error('[SearchService] Apple autocomplete error:', error);
        return [];
    }
}

// =============================================================================
// OSM Nominatim API (Android/Global — free, no API key)
// =============================================================================

interface NominatimResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
    address?: {
        road?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        country?: string;
        suburb?: string;
    };
}

/**
 * Search using OpenStreetMap Nominatim API
 * Free, no API key required, rate limit: 1 request/second
 * https://nominatim.org/release-docs/latest/api/Search/
 */
async function searchNominatim(
    query: string,
    language: string = 'en',
    limit: number = 10,
): Promise<SearchResult[]> {
    try {
        const params = new URLSearchParams({
            q: query,
            format: 'json',
            limit: String(limit),
            addressdetails: '1',
            'accept-language': language,
        });

        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?${params.toString()}`,
            {
                headers: {
                    'User-Agent': 'LocaAlert/1.0 (com.mnisik.app)',
                },
            },
        );

        if (!response.ok) {
            throw new Error(`Nominatim API error: ${response.status}`);
        }

        const json: NominatimResult[] = await response.json();

        return json.map((item, index) => {
            const addr = item.address;
            const city = addr?.city || addr?.town || addr?.village || '';
            const addressStr = [addr?.road, addr?.suburb, city, addr?.state]
                .filter(Boolean)
                .join(', ') || item.display_name;

            return {
                id: `osm-${item.place_id}`,
                name: item.name || item.display_name.split(',')[0],
                address: addressStr,
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                source: 'OSM' as const,
                relevanceScore: 100 - index,
            };
        }).filter(r => !isNaN(r.latitude!) && !isNaN(r.longitude!));
    } catch (error) {
        console.error('[SearchService] Nominatim search error:', error);
        return [];
    }
}

// =============================================================================
// Expo Location Fallback (Free, cross-platform)
// =============================================================================

async function searchExpoFallback(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
        const results = await Location.geocodeAsync(query);

        if (results.length === 0) {
            return [];
        }

        const enrichedResults = await Promise.all(
            results.slice(0, limit).map(async (result, index) => {
                try {
                    const reverseResults = await Location.reverseGeocodeAsync({
                        latitude: result.latitude,
                        longitude: result.longitude,
                    });

                    if (reverseResults.length > 0) {
                        const r = reverseResults[0];
                        return {
                            id: `expo-${index}`,
                            name: r.name || r.street || query,
                            address: [r.city, r.district, r.street, r.streetNumber]
                                .filter(Boolean)
                                .join(' ') || `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`,
                            latitude: result.latitude,
                            longitude: result.longitude,
                            source: 'EXPO' as const,
                            relevanceScore: 50 - index,
                        };
                    }
                } catch {
                    // Ignore individual reverse geocode errors
                }

                return {
                    id: `expo-${index}`,
                    name: query,
                    address: `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`,
                    latitude: result.latitude,
                    longitude: result.longitude,
                    source: 'EXPO' as const,
                    relevanceScore: 50 - index,
                };
            })
        );

        return enrichedResults as SearchResult[];
    } catch (error) {
        console.error('[SearchService] Expo fallback error:', error);
        return [];
    }
}

// =============================================================================
// Unified Search Function (Main Export)
// =============================================================================

/**
 * Platform-aware place search with intelligent API selection
 *
 * Priority:
 * 1. Korea → Kakao Maps API (best Korean address coverage)
 * 2. iOS + Global → Apple MapKit JS (native iOS experience)
 * 3. Android + Global → OSM Nominatim (free, no API key)
 * 4. Fallback → Expo Location geocoding
 */
export async function searchPlaces(options: SearchOptions): Promise<SearchResult[]> {
    const { query, currentLocation, language = 'en', limit = 10 } = options;

    if (!query || query.trim().length < 2) {
        return [];
    }

    const trimmedQuery = query.trim();
    const inKorea = isInKorea(currentLocation.latitude, currentLocation.longitude);
    const isIOS = Platform.OS === 'ios';

    console.log(`[SearchService] Searching "${trimmedQuery}" | Korea: ${inKorea} | iOS: ${isIOS}`);

    let results: SearchResult[] = [];

    // Priority 1: Korea → Kakao
    if (inKorea) {
        results = await searchKakao(trimmedQuery, limit);
        if (results.length > 0) {
            return results;
        }
    }

    // Priority 2: iOS (non-Korea) → Apple MapKit JS
    if (isIOS && !inKorea) {
        results = await searchApple(trimmedQuery, currentLocation, language, limit);
        if (results.length > 0) {
            return results;
        }
    }

    // Priority 3: Android or iOS fallback → OSM Nominatim
    if (!isIOS || results.length === 0) {
        results = await searchNominatim(trimmedQuery, language, limit);
        if (results.length > 0) {
            return results;
        }
    }

    // Priority 4: Final fallback → Expo Location
    console.log('[SearchService] Using Expo fallback');
    return searchExpoFallback(trimmedQuery, limit);
}

/**
 * Autocomplete search (optimized for real-time typing)
 * Returns suggestions faster with less detailed results
 */
export async function autocompleteSearch(options: SearchOptions): Promise<SearchResult[]> {
    const { query, currentLocation, language = 'en', limit = 5 } = options;

    if (!query || query.trim().length < 2) {
        return [];
    }

    const trimmedQuery = query.trim();
    const inKorea = isInKorea(currentLocation.latitude, currentLocation.longitude);
    const isIOS = Platform.OS === 'ios';

    // Korea → Kakao (same as full search, Kakao is already fast)
    if (inKorea) {
        return searchKakao(trimmedQuery, limit);
    }

    // iOS → Apple Autocomplete
    if (isIOS) {
        const appleResults = await autocompleteApple(trimmedQuery, currentLocation, language, limit);
        if (appleResults.length > 0) {
            return appleResults;
        }
    }

    // Android/fallback → OSM Nominatim
    return searchNominatim(trimmedQuery, language, limit);
}

// =============================================================================
// Debounced Search (Rate limiting)
// =============================================================================

let searchTimeout: NodeJS.Timeout | null = null;
let lastSearchQuery: string = '';

export function debouncedSearch(
    options: SearchOptions,
    callback: (results: SearchResult[]) => void,
    debounceMs: number = 300
): void {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    if (options.query === lastSearchQuery) {
        return;
    }

    lastSearchQuery = options.query;

    searchTimeout = setTimeout(async () => {
        const results = await searchPlaces(options);
        callback(results);
    }, debounceMs);
}

export function cancelPendingSearch(): void {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
        searchTimeout = null;
    }
    lastSearchQuery = '';
}

/**
 * Unified Search Service
 *
 * Platform-aware search with prioritized API selection:
 * 1. Korea → Kakao Maps API
 * 2. iOS (Global) → Apple MapKit JS API
 * 3. Android/Fallback → Google Places API
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
    source: 'KAKAO' | 'GOOGLE' | 'APPLE' | 'EXPO';
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
    googleApiKey?: string;
    appleMapKitToken?: string;
}

// =============================================================================
// API Keys Configuration
// =============================================================================

const config: SearchConfig = {
    kakaoApiKey: process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY || '',
    googleApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '',
    appleMapKitToken: process.env.EXPO_PUBLIC_APPLE_MAPKIT_TOKEN || '',
};

// =============================================================================
// Geofencing - Korea Detection
// =============================================================================

export function isInKorea(lat: number, lon: number): boolean {
    return lat >= 33.0 && lat <= 38.9 && lon >= 124.5 && lon <= 132.0;
}

// =============================================================================
// Session Token Management (Google Places billing optimization)
// =============================================================================

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

let googleSessionToken: string | null = null;
let sessionTokenCreatedAt: number = 0;
const SESSION_TOKEN_EXPIRY_MS = 3 * 60 * 1000;

function getOrCreateGoogleSessionToken(): string {
    const now = Date.now();
    if (!googleSessionToken || (now - sessionTokenCreatedAt) > SESSION_TOKEN_EXPIRY_MS) {
        googleSessionToken = generateUUID();
        sessionTokenCreatedAt = now;
    }
    return googleSessionToken;
}

export function resetGoogleSessionToken(): void {
    googleSessionToken = null;
    sessionTokenCreatedAt = 0;
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
        }));
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
        }));
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
// Google Places API (Android/Global Fallback)
// =============================================================================

interface GooglePrediction {
    place_id: string;
    structured_formatting: { main_text: string; secondary_text: string };
    description: string;
}

interface GoogleAutocompleteResponse {
    predictions: GooglePrediction[];
    status: string;
    error_message?: string;
}

interface GooglePlaceDetailsResponse {
    result: {
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
        name: string;
    };
    status: string;
}

async function searchGoogle(
    query: string,
    language: string = 'en',
    limit: number = 10
): Promise<SearchResult[]> {
    // Skip Google on iOS if no key configured - use Apple/Expo instead
    if (!config.googleApiKey) {
        if (Platform.OS === 'ios') {
            return []; // Will fall through to Expo
        }
        console.warn('[SearchService] Google API key not configured');
        return [];
    }

    try {
        const sessionToken = getOrCreateGoogleSessionToken();
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${config.googleApiKey}&sessiontoken=${sessionToken}&language=${language}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Google API error: ${response.status}`);
        }

        const json: GoogleAutocompleteResponse = await response.json();

        if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
            throw new Error(`Google API status: ${json.status} - ${json.error_message}`);
        }

        return json.predictions.slice(0, limit).map((item, index) => ({
            id: item.place_id,
            name: item.structured_formatting.main_text,
            address: item.structured_formatting.secondary_text || item.description,
            placeId: item.place_id,
            source: 'GOOGLE' as const,
            relevanceScore: 100 - index,
        }));
    } catch (error) {
        console.error('[SearchService] Google search error:', error);
        return [];
    }
}

/**
 * Get coordinates from Google Place ID
 */
export async function getGooglePlaceDetails(
    placeId: string
): Promise<{ latitude: number; longitude: number } | null> {
    if (!config.googleApiKey) {
        return null;
    }

    try {
        const sessionToken = getOrCreateGoogleSessionToken();
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address,name&key=${config.googleApiKey}&sessiontoken=${sessionToken}`;

        const response = await fetch(url);
        const json: GooglePlaceDetailsResponse = await response.json();

        if (json.status !== 'OK') {
            throw new Error(`Google Place Details error: ${json.status}`);
        }

        resetGoogleSessionToken();

        return {
            latitude: json.result.geometry.location.lat,
            longitude: json.result.geometry.location.lng,
        };
    } catch (error) {
        console.error('[SearchService] Google place details error:', error);
        return null;
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
 * 3. Android + Global → Google Places API
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

    // Priority 3: Android or iOS fallback → Google Places
    if (!isIOS || results.length === 0) {
        results = await searchGoogle(trimmedQuery, language, limit);
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

    // Android/fallback → Google
    return searchGoogle(trimmedQuery, language, limit);
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

// =============================================================================
// Re-exports for backward compatibility
// =============================================================================

export { resetGoogleSessionToken as resetSessionToken };

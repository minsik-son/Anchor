/**
 * Hybrid Place Search Service
 * 
 * Uses Kakao API for Korea and Google Places API for global searches.
 * Automatically detects user location and switches between APIs.
 */

// =============================================================================
// UUID Generator (for session tokens)
// =============================================================================

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface PlaceResult {
    id: string;
    name: string;           // 장소명 (e.g., 강남역, Starbucks)
    address: string;        // 주소
    latitude?: number;      // Kakao provides coordinates directly
    longitude?: number;
    placeId?: string;       // Google Place ID (needs additional API call for coords)
    source: 'KAKAO' | 'GOOGLE' | 'EXPO';
}

export interface PlaceSearchOptions {
    query: string;
    currentLocation: { latitude: number; longitude: number };
    sessionToken?: string;  // For Google Places API billing optimization
    language?: string;      // Language preference
}

// =============================================================================
// API Keys Configuration
// =============================================================================

// TODO: Move to environment variables (.env) for production
const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY || '';
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

// =============================================================================
// Geofencing - Korea Detection
// =============================================================================

/**
 * Check if coordinates are within South Korea bounds
 * Korea approximate bounds:
 * - Latitude: 33.0 ~ 38.9
 * - Longitude: 124.5 ~ 132.0
 */
export function isInKorea(lat: number, lon: number): boolean {
    return lat >= 33.0 && lat <= 38.9 && lon >= 124.5 && lon <= 132.0;
}

// =============================================================================
// Session Token Management (for Google Places API billing optimization)
// =============================================================================

let currentSessionToken: string | null = null;
let sessionTokenCreatedAt: number = 0;
const SESSION_TOKEN_EXPIRY_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Generate or reuse session token for Google Places API
 * Session tokens group autocomplete requests and place details into a single billing event
 */
export async function getOrCreateSessionToken(): Promise<string> {
    const now = Date.now();

    // Create new token if expired or doesn't exist
    if (!currentSessionToken || (now - sessionTokenCreatedAt) > SESSION_TOKEN_EXPIRY_MS) {
        currentSessionToken = generateUUID();
        sessionTokenCreatedAt = now;
    }

    return currentSessionToken as string;
}

/**
 * Reset session token after user selects a place
 * This is important for proper billing grouping
 */
export function resetSessionToken(): void {
    currentSessionToken = null;
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
    x: string;  // longitude
    y: string;  // latitude
    category_name?: string;
}

interface KakaoSearchResponse {
    documents: KakaoDocument[];
    meta: {
        total_count: number;
        pageable_count: number;
        is_end: boolean;
    };
}

/**
 * Search places using Kakao Local API
 * Free, high accuracy for Korean addresses
 */
async function searchKakao(query: string): Promise<PlaceResult[]> {
    if (!KAKAO_REST_API_KEY) {
        console.warn('[PlaceSearch] Kakao API key not configured, falling back to Expo');
        return [];
    }

    try {
        const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=10`;

        const response = await fetch(url, {
            headers: {
                Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Kakao API error: ${response.status}`);
        }

        const json: KakaoSearchResponse = await response.json();

        return json.documents.map((item) => ({
            id: item.id,
            name: item.place_name,
            address: item.road_address_name || item.address_name,
            latitude: parseFloat(item.y),
            longitude: parseFloat(item.x),
            source: 'KAKAO' as const,
        }));
    } catch (error) {
        console.error('[PlaceSearch] Kakao search error:', error);
        return [];
    }
}

// =============================================================================
// Google Places Autocomplete API (Global)
// =============================================================================

interface GooglePrediction {
    place_id: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
    description: string;
}

interface GoogleAutocompleteResponse {
    predictions: GooglePrediction[];
    status: string;
    error_message?: string;
}

interface GooglePlaceDetailsResponse {
    result: {
        geometry: {
            location: {
                lat: number;
                lng: number;
            };
        };
        formatted_address: string;
        name: string;
    };
    status: string;
}

/**
 * Search places using Google Places Autocomplete API
 * Paid, global coverage
 */
async function searchGoogle(query: string, sessionToken: string, language: string = 'en'): Promise<PlaceResult[]> {
    if (!GOOGLE_PLACES_API_KEY) {
        console.warn('[PlaceSearch] Google Places API key not configured, falling back to Expo');
        return [];
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}&sessiontoken=${sessionToken}&language=${language}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Google API error: ${response.status}`);
        }

        const json: GoogleAutocompleteResponse = await response.json();

        if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
            throw new Error(`Google API status: ${json.status} - ${json.error_message}`);
        }

        return json.predictions.map((item) => ({
            id: item.place_id,
            name: item.structured_formatting.main_text,
            address: item.structured_formatting.secondary_text || item.description,
            placeId: item.place_id,
            source: 'GOOGLE' as const,
        }));
    } catch (error) {
        console.error('[PlaceSearch] Google search error:', error);
        return [];
    }
}

/**
 * Get place details (coordinates) from Google Place ID
 * Called when user selects a Google search result
 */
export async function getGooglePlaceDetails(
    placeId: string,
    sessionToken: string
): Promise<{ latitude: number; longitude: number } | null> {
    if (!GOOGLE_PLACES_API_KEY) {
        console.error('[PlaceSearch] Google API key not configured');
        return null;
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address,name&key=${GOOGLE_PLACES_API_KEY}&sessiontoken=${sessionToken}`;

        const response = await fetch(url);
        const json: GooglePlaceDetailsResponse = await response.json();

        if (json.status !== 'OK') {
            throw new Error(`Google Place Details error: ${json.status}`);
        }

        // Reset session token after successful place details request
        resetSessionToken();

        return {
            latitude: json.result.geometry.location.lat,
            longitude: json.result.geometry.location.lng,
        };
    } catch (error) {
        console.error('[PlaceSearch] Google place details error:', error);
        return null;
    }
}

// =============================================================================
// Expo Location Fallback (Free, but limited)
// =============================================================================

import * as Location from 'expo-location';

/**
 * Fallback search using Expo Location geocoding
 * Limited but free, works without API keys
 */
async function searchExpoFallback(query: string): Promise<PlaceResult[]> {
    try {
        const results = await Location.geocodeAsync(query);

        if (results.length === 0) {
            return [];
        }

        // Get reverse geocode for better address info
        const enrichedResults = await Promise.all(
            results.slice(0, 5).map(async (result, index) => {
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
                        };
                    }
                } catch (e) {
                    // Ignore individual reverse geocode errors
                }

                return {
                    id: `expo-${index}`,
                    name: query,
                    address: `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`,
                    latitude: result.latitude,
                    longitude: result.longitude,
                    source: 'EXPO' as const,
                };
            })
        );

        return enrichedResults as PlaceResult[];
    } catch (error) {
        console.error('[PlaceSearch] Expo fallback error:', error);
        return [];
    }
}

// =============================================================================
// Hybrid Search (Main Export)
// =============================================================================

/**
 * Main hybrid search function
 * Automatically switches between Kakao (Korea) and Google (Global) based on location
 * Falls back to Expo geocoding if API keys are not configured
 */
export async function searchPlaces(options: PlaceSearchOptions): Promise<PlaceResult[]> {
    const { query, currentLocation, language = 'ko' } = options;

    // Minimum query length
    if (!query || query.trim().length < 2) {
        return [];
    }

    const trimmedQuery = query.trim();
    const inKorea = isInKorea(currentLocation.latitude, currentLocation.longitude);

    console.log(`[PlaceSearch] Searching "${trimmedQuery}" | Location: ${inKorea ? 'Korea' : 'Global'}`);

    // Try primary API based on location
    let results: PlaceResult[] = [];

    if (inKorea) {
        // Use Kakao for Korea
        results = await searchKakao(trimmedQuery);

        // Fallback to Expo if Kakao fails or not configured
        if (results.length === 0) {
            console.log('[PlaceSearch] Kakao returned no results, trying Expo fallback');
            results = await searchExpoFallback(trimmedQuery);
        }
    } else {
        // Use Google for Global
        const sessionToken = await getOrCreateSessionToken();
        results = await searchGoogle(trimmedQuery, sessionToken, language);

        // Fallback to Expo if Google fails or not configured
        if (results.length === 0) {
            console.log('[PlaceSearch] Google returned no results, trying Expo fallback');
            results = await searchExpoFallback(trimmedQuery);
        }
    }

    return results;
}

// =============================================================================
// Debounced Search (Prevents rate limiting)
// =============================================================================

let searchTimeout: NodeJS.Timeout | null = null;
let lastSearchQuery: string = '';

/**
 * Debounced place search to prevent API rate limiting
 */
export function debouncedSearchPlaces(
    options: PlaceSearchOptions,
    callback: (results: PlaceResult[]) => void,
    debounceMs: number = 350
): void {
    // Clear existing timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // Skip if same query
    if (options.query === lastSearchQuery) {
        return;
    }

    lastSearchQuery = options.query;

    // Set new timeout
    searchTimeout = setTimeout(async () => {
        const results = await searchPlaces(options);
        callback(results);
    }, debounceMs);
}

/**
 * Cancel pending search
 */
export function cancelPendingSearch(): void {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
        searchTimeout = null;
    }
}

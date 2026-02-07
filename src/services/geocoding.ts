/**
 * Geocoding Service
 * Language-aware reverse geocoding with debouncing and caching
 * Uses Google Maps Geocoding API for language support
 */

import * as Location from 'expo-location';
import i18n from '../i18n';

export interface GeocodingResult {
    address: string;      // Full address
    detail?: string;      // POI name or building
    city?: string;
    district?: string;
}

// Google Maps Geocoding API key
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

// Language-aware cache for geocoding results
// Key format: "lat,lng:language"
const geocodeCache = new Map<string, GeocodingResult>();

// Track current language for cache invalidation
let cachedLanguage = i18n.language;

function getCacheKey(latitude: number, longitude: number, language: string): string {
    // Round to 5 decimal places (~1m precision) and include language
    return `${latitude.toFixed(5)},${longitude.toFixed(5)}:${language}`;
}

/**
 * Map i18n language code to Google Geocoding API language code
 */
function getGoogleLanguageCode(lang: string): string {
    const languageMap: Record<string, string> = {
        'ko': 'ko',
        'en': 'en',
        'ja': 'ja',
    };
    return languageMap[lang] || 'ko';
}

/**
 * Reverse geocode using Google Maps Geocoding API (language-aware)
 */
async function reverseGeocodeWithGoogle(
    latitude: number,
    longitude: number,
    language: string
): Promise<GeocodingResult | null> {
    if (!GOOGLE_MAPS_API_KEY) {
        console.log('[Geocoding] Google API key not configured, using fallback');
        return null;
    }

    try {
        const googleLang = getGoogleLanguageCode(language);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&language=${googleLang}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Google Geocoding API error: ${response.status}`);
        }

        const json = await response.json();

        if (json.status !== 'OK' || !json.results || json.results.length === 0) {
            console.log('[Geocoding] No results from Google API:', json.status);
            return null;
        }

        // Parse Google Geocoding response
        const result = json.results[0];
        const addressComponents = result.address_components || [];

        // Extract useful components
        let city = '';
        let district = '';
        let sublocality = '';
        let street = '';
        let streetNumber = '';

        for (const component of addressComponents) {
            const types = component.types || [];

            if (types.includes('locality') || types.includes('administrative_area_level_1')) {
                city = city || component.long_name;
            }
            if (types.includes('sublocality_level_1') || types.includes('administrative_area_level_2')) {
                district = district || component.long_name;
            }
            if (types.includes('sublocality_level_2') || types.includes('sublocality')) {
                sublocality = sublocality || component.long_name;
            }
            if (types.includes('route')) {
                street = component.long_name;
            }
            if (types.includes('street_number')) {
                streetNumber = component.long_name;
            }
        }

        // Build address based on language style
        let address = '';
        if (language === 'ko' || language === 'ja') {
            // Korean/Japanese style: city → district → street → number
            const parts = [city, district, sublocality, street, streetNumber].filter(Boolean);
            address = parts.join(' ') || result.formatted_address;
        } else {
            // Western style: number → street → district → city
            const parts = [streetNumber, street, sublocality, district, city].filter(Boolean);
            address = parts.join(', ') || result.formatted_address;
        }

        // Try to get a detail/POI name from a more specific result
        let detail: string | undefined;
        if (json.results.length > 1) {
            const poiResult = json.results.find((r: any) =>
                r.types?.includes('point_of_interest') ||
                r.types?.includes('establishment') ||
                r.types?.includes('premise')
            );
            if (poiResult) {
                detail = poiResult.formatted_address?.split(',')[0];
            }
        }

        return {
            address: address || result.formatted_address || i18n.t('address.notFound'),
            detail,
            city: city || undefined,
            district: district || sublocality || undefined,
        };
    } catch (error) {
        console.error('[Geocoding] Google API error:', error);
        return null;
    }
}

/**
 * Fallback: Reverse geocode using Expo Location (no language support)
 */
async function reverseGeocodeWithExpo(
    latitude: number,
    longitude: number
): Promise<GeocodingResult> {
    try {
        const results = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
        });

        if (results.length === 0) {
            return { address: i18n.t('address.notFound') };
        }

        const result = results[0];

        // Build address from components
        const addressParts: string[] = [];

        if (result.city) addressParts.push(result.city);
        if (result.district) addressParts.push(result.district);
        if (result.street) addressParts.push(result.street);
        if (result.streetNumber) addressParts.push(result.streetNumber);

        return {
            address: addressParts.length > 0
                ? addressParts.join(' ')
                : result.formattedAddress || i18n.t('address.notFound'),
            detail: result.name || undefined,
            city: result.city || undefined,
            district: result.district || undefined,
        };
    } catch (error) {
        console.error('[Geocoding] Expo fallback error:', error);
        return { address: i18n.t('address.loadFailed') };
    }
}

/**
 * Reverse geocode coordinates to address with language support
 */
export async function reverseGeocode(
    latitude: number,
    longitude: number,
    language?: string
): Promise<GeocodingResult> {
    const currentLanguage = language || i18n.language;
    const cacheKey = getCacheKey(latitude, longitude, currentLanguage);

    // Check cache first
    const cached = geocodeCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    // Try Google API first (language-aware)
    let result = await reverseGeocodeWithGoogle(latitude, longitude, currentLanguage);

    // Fallback to Expo if Google fails
    if (!result) {
        result = await reverseGeocodeWithExpo(latitude, longitude);
    }

    // Cache the result
    geocodeCache.set(cacheKey, result);

    return result;
}

/**
 * Debounced reverse geocode
 */
let debounceTimer: NodeJS.Timeout | null = null;

export function debouncedReverseGeocode(
    latitude: number,
    longitude: number,
    callback: (result: GeocodingResult) => void,
    delay: number = 300
): void {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
        try {
            const result = await reverseGeocode(latitude, longitude);
            callback(result);
        } catch (error) {
            console.error('[Geocoding] Debounced geocode failed:', error);
            callback({ address: i18n.t('address.loadFailed') });
        }
    }, delay);
}

/**
 * Cancel pending debounced geocode
 */
export function cancelPendingGeocode(): void {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}

/**
 * Clear geocoding cache
 * Call this when language changes to force re-fetch
 */
export function clearGeocodeCache(): void {
    geocodeCache.clear();
}

/**
 * Check if language has changed and cache needs refresh
 */
export function hasLanguageChanged(): boolean {
    const currentLang = i18n.language;
    if (currentLang !== cachedLanguage) {
        cachedLanguage = currentLang;
        return true;
    }
    return false;
}

/**
 * Get current geocoding language
 */
export function getCurrentGeocodingLanguage(): string {
    return i18n.language;
}

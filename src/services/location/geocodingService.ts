/**
 * Geocoding Service
 * Language-aware reverse geocoding with debouncing and caching
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */

import * as Location from 'expo-location';
import i18n from '../../i18n';

export interface GeocodingResult {
    address: string;      // Full address
    detail?: string;      // POI name or building
    city?: string;
    district?: string;
}

// OSM Nominatim response structure
interface NominatimResponse {
    display_name: string;
    address: {
        amenity?: string;
        building?: string;
        house_number?: string;
        road?: string;
        neighbourhood?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        country?: string;
    };
    error?: string;
}

// User-Agent header required by OSM Nominatim policy
const USER_AGENT = 'LocaAlert/1.0 (location-alarm-app)';

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
 * Map i18n language code to OSM Nominatim accept-language format
 */
function getNominatimLanguageCode(lang: string): string {
    const languageMap: Record<string, string> = {
        'ko': 'ko',
        'en': 'en',
        'ja': 'ja',
    };
    return languageMap[lang] || 'ko';
}

/**
 * Format address based on language style
 * Korean/Japanese: large area → small area (city → district → road → number)
 * English: small area → large area (number → road → district → city)
 */
function formatAddressByLanguage(
    nominatimAddress: NominatimResponse['address'],
    displayName: string,
    language: string
): string {
    const {
        house_number,
        road,
        neighbourhood,
        suburb,
        city,
        town,
        village,
        county,
        state,
    } = nominatimAddress;

    // Determine city (OSM uses different fields based on location)
    const cityName = city || town || village || county || '';
    const districtName = suburb || neighbourhood || '';

    if (language === 'ko' || language === 'ja') {
        // Korean/Japanese style: city → district → road → number
        const parts = [cityName, districtName, road, house_number].filter(Boolean);
        return parts.length > 0 ? parts.join(' ') : displayName;
    } else {
        // Western style: number → road → district → city
        const parts = [house_number, road, districtName, cityName].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : displayName;
    }
}

/**
 * Reverse geocode using OSM Nominatim API (language-aware)
 */
async function reverseGeocodeWithNominatim(
    latitude: number,
    longitude: number,
    language: string
): Promise<GeocodingResult | null> {
    try {
        const nominatimLang = getNominatimLanguageCode(language);
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&accept-language=${nominatimLang}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept-Language': nominatimLang,
            },
        });

        if (!response.ok) {
            throw new Error(`Nominatim API error: ${response.status}`);
        }

        const json: NominatimResponse = await response.json();

        if (json.error) {
            console.log('[Geocoding] Nominatim error:', json.error);
            return null;
        }

        const nominatimAddress = json.address || {};

        // Extract city and district
        const city = nominatimAddress.city || nominatimAddress.town || nominatimAddress.village || nominatimAddress.county || undefined;
        const district = nominatimAddress.suburb || nominatimAddress.neighbourhood || undefined;

        // Format address based on language
        const formattedAddress = formatAddressByLanguage(nominatimAddress, json.display_name, language);

        // Get detail (POI name or building)
        const detail = nominatimAddress.amenity || nominatimAddress.building || undefined;

        return {
            address: formattedAddress || i18n.t('address.notFound'),
            detail,
            city,
            district,
        };
    } catch (error) {
        console.error('[Geocoding] Nominatim API error:', error);
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

    // Try OSM Nominatim first (language-aware)
    let result = await reverseGeocodeWithNominatim(latitude, longitude, currentLanguage);

    // Fallback to Expo if Nominatim fails
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

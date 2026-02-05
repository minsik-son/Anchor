/**
 * Geocoding Service
 * Reverse geocoding with debouncing and caching
 */

import * as Location from 'expo-location';

export interface GeocodingResult {
    address: string;      // Full address
    detail?: string;      // POI name or building
    city?: string;
    district?: string;
}

// Simple cache for geocoding results
const geocodeCache = new Map<string, GeocodingResult>();

function getCacheKey(latitude: number, longitude: number): string {
    // Round to 5 decimal places (~1m precision)
    return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(
    latitude: number,
    longitude: number
): Promise<GeocodingResult> {
    const cacheKey = getCacheKey(latitude, longitude);

    // Check cache first
    const cached = geocodeCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const results = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
        });

        if (results.length === 0) {
            return { address: '주소를 찾을 수 없습니다' };
        }

        const result = results[0];

        // Build Korean-style address
        const addressParts: string[] = [];

        if (result.city) addressParts.push(result.city);
        if (result.district) addressParts.push(result.district);
        if (result.street) addressParts.push(result.street);
        if (result.streetNumber) addressParts.push(result.streetNumber);

        const geocodingResult: GeocodingResult = {
            address: addressParts.length > 0
                ? addressParts.join(' ')
                : result.formattedAddress || '주소를 찾을 수 없습니다',
            detail: result.name || undefined,
            city: result.city || undefined,
            district: result.district || undefined,
        };

        // Cache the result
        geocodeCache.set(cacheKey, geocodingResult);

        return geocodingResult;
    } catch (error) {
        console.error('[Geocoding] Error:', error);
        return { address: '주소를 불러올 수 없습니다' };
    }
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
        const result = await reverseGeocode(latitude, longitude);
        callback(result);
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
 */
export function clearGeocodeCache(): void {
    geocodeCache.clear();
}

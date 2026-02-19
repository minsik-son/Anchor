/**
 * Geocoding Service
 * Reverse geocoding with debouncing and caching
 */

import * as Location from 'expo-location';
import i18n from '../i18n';

export interface GeocodingResult {
    address: string;      // Full address
    detail?: string;      // POI name or building
    city?: string;
    district?: string;
}

// LRU cache for geocoding results (bounded to prevent memory leaks)
const MAX_CACHE_SIZE = 100;
const geocodeCache = new Map<string, GeocodingResult>();

function getCacheKey(latitude: number, longitude: number): string {
    // Round to 5 decimal places (~1m precision)
    return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

/** LRU-aware cache set: evicts oldest entry when max size is reached */
function setCacheEntry(key: string, value: GeocodingResult): void {
    // If key exists, delete first to refresh insertion order
    if (geocodeCache.has(key)) {
        geocodeCache.delete(key);
    }
    // Evict oldest entry if at capacity
    if (geocodeCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = geocodeCache.keys().next().value;
        if (oldestKey !== undefined) {
            geocodeCache.delete(oldestKey);
        }
    }
    geocodeCache.set(key, value);
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
            return { address: i18n.t('geocoding.addressNotFound') };
        }

        const result = results[0];

        // Build address from parts
        const addressParts: string[] = [];

        if (result.city) addressParts.push(result.city);
        if (result.district) addressParts.push(result.district);
        if (result.street) addressParts.push(result.street);
        if (result.streetNumber) addressParts.push(result.streetNumber);

        const geocodingResult: GeocodingResult = {
            address: addressParts.length > 0
                ? addressParts.join(' ')
                : result.formattedAddress || i18n.t('geocoding.addressNotFound'),
            detail: result.name || undefined,
            city: result.city || undefined,
            district: result.district || undefined,
        };

        // Cache the result (LRU bounded)
        setCacheEntry(cacheKey, geocodingResult);

        return geocodingResult;
    } catch (error) {
        console.error('[Geocoding] Error:', error);
        return { address: i18n.t('geocoding.failedToLoad') };
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

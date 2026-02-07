/**
 * Geocoding Service
 * Re-exports from location/geocodingService for backward compatibility
 */
export {
    type GeocodingResult,
    reverseGeocode,
    debouncedReverseGeocode,
    cancelPendingGeocode,
    clearGeocodeCache,
    hasLanguageChanged,
    getCurrentGeocodingLanguage,
} from './location/geocodingService';

import { useMemo } from 'react';
import { useUnitStore, DistanceUnit } from '../stores/unitStore';

// Conversion constants
const METERS_TO_FEET = 3.28084;
const KM_TO_MILES = 0.621371;
const FEET_PER_MILE = 5280;

interface FormatOptions {
    decimals?: number;
    showUnit?: boolean;
}

/**
 * Format distance in meters to user's preferred unit
 */
export function formatDistance(
    meters: number | null,
    unit: DistanceUnit,
    options: FormatOptions = {}
): string {
    const { decimals = 1, showUnit = true } = options;

    if (meters === null) return '--';

    if (unit === 'metric') {
        if (meters >= 1000) {
            const km = meters / 1000;
            return showUnit ? `${km.toFixed(decimals)}km` : km.toFixed(decimals);
        }
        return showUnit ? `${Math.round(meters)}m` : `${Math.round(meters)}`;
    }

    // Imperial
    const feet = meters * METERS_TO_FEET;
    if (feet >= FEET_PER_MILE) {
        const miles = feet / FEET_PER_MILE;
        return showUnit ? `${miles.toFixed(decimals)}mi` : miles.toFixed(decimals);
    }
    return showUnit ? `${Math.round(feet)}ft` : `${Math.round(feet)}`;
}

/**
 * Format radius value (always shows units)
 */
export function formatRadius(meters: number, unit: DistanceUnit): string {
    return formatDistance(meters, unit, { showUnit: true });
}

/**
 * Format speed from km/h to user's preferred unit
 */
export function formatSpeed(
    kmh: number | null,
    unit: DistanceUnit
): { value: string; unit: string } {
    if (kmh === null || kmh < 0) {
        return { value: '--', unit: unit === 'metric' ? 'km/h' : 'mph' };
    }

    if (unit === 'metric') {
        return { value: `${Math.round(kmh)}`, unit: 'km/h' };
    }

    const mph = kmh * KM_TO_MILES;
    return { value: `${Math.round(mph)}`, unit: 'mph' };
}

/**
 * Get the min/max radius labels based on unit
 */
export function getRadiusLabels(unit: DistanceUnit): { min: string; max: string } {
    if (unit === 'metric') {
        return { min: '50m', max: '2km' };
    }
    // 50m = ~164ft, 2000m = ~1.24mi
    return { min: '164ft', max: '1.2mi' };
}

/**
 * React hook combining store with formatting utilities
 */
export function useDistanceFormatter() {
    const distanceUnit = useUnitStore((state) => state.distanceUnit);

    return useMemo(() => ({
        distanceUnit,
        formatDistance: (meters: number | null, options?: FormatOptions) =>
            formatDistance(meters, distanceUnit, options),
        formatRadius: (meters: number) =>
            formatRadius(meters, distanceUnit),
        formatSpeed: (kmh: number | null) =>
            formatSpeed(kmh, distanceUnit),
        getRadiusLabels: () =>
            getRadiusLabels(distanceUnit),
    }), [distanceUnit]);
}

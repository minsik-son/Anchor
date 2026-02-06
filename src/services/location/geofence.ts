/**
 * Geofence utilities
 * Check if user is within alarm radius
 */

export interface Coordinate {
    latitude: number;
    longitude: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(from: Coordinate, to: Coordinate): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

/**
 * Check if a point is within a radius of another point
 */
export function isWithinRadius(
    point: Coordinate,
    center: Coordinate,
    radiusMeters: number
): boolean {
    const distance = calculateDistance(point, center);
    return distance <= radiusMeters;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Calculate bearing (direction) from one coordinate to another
 * Returns bearing in degrees (0-360)
 */
export function calculateBearing(from: Coordinate, to: Coordinate): number {
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
        Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    const bearing = ((θ * 180) / Math.PI + 360) % 360;

    return bearing;
}

/**
 * Get cardinal direction from bearing
 */
export function getCardinalDirection(bearing: number): string {
    const directions = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
}

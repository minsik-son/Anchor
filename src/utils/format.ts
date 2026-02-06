/**
 * Formatting utilities
 */

export function formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
}

export function formatDistanceOrFallback(meters: number | null, fallback = '--'): string {
    if (meters === null) return fallback;
    return formatDistance(meters);
}

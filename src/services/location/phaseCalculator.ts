/**
 * Phase calculation utilities - extracted for testability
 * Pure functions that determine tracking phase transitions
 */

import {
    PHASE_BOUNDARIES,
    ADAPTIVE_POLLING_CONFIG,
} from '../../constants/trackingConfig';
import { TrackingPhase } from '../../stores/locationStore';

/**
 * Calculate dynamic cooldown for ADAPTIVE_POLLING based on distance & speed.
 * Returns cooldown in milliseconds.
 */
export function calculateDynamicCooldown(distanceMeters: number, speedKmh: number): number {
    const effectiveSpeed = Math.max(speedKmh, ADAPTIVE_POLLING_CONFIG.MIN_ASSUMED_SPEED_KMH);
    const speedMs = (effectiveSpeed * 1000) / 3600;
    const etaSeconds = distanceMeters / speedMs;
    let cooldownMs = (etaSeconds / 2) * 1000;

    if (speedKmh > ADAPTIVE_POLLING_CONFIG.HIGH_SPEED_THRESHOLD_KMH) {
        cooldownMs *= ADAPTIVE_POLLING_CONFIG.HIGH_SPEED_COOLDOWN_MULTIPLIER;
    }

    const maxCooldown = distanceMeters > PHASE_BOUNDARIES.LONG_RANGE_POLLING_THRESHOLD
        ? ADAPTIVE_POLLING_CONFIG.LONG_RANGE_MAX_COOLDOWN_MS
        : ADAPTIVE_POLLING_CONFIG.MAX_COOLDOWN_MS;

    return Math.max(
        ADAPTIVE_POLLING_CONFIG.MIN_COOLDOWN_MS,
        Math.min(maxCooldown, cooldownMs),
    );
}

/**
 * Should we transition into ACTIVE_TRACKING?
 */
export function shouldEnterActiveTracking(distanceMeters: number, speedKmh: number): boolean {
    if (distanceMeters < PHASE_BOUNDARIES.ADAPTIVE_POLLING_MIN) return true;

    const effectiveSpeed = Math.max(speedKmh, ADAPTIVE_POLLING_CONFIG.MIN_ASSUMED_SPEED_KMH);
    const speedMs = (effectiveSpeed * 1000) / 3600;
    const etaMinutes = (distanceMeters / speedMs) / 60;
    return etaMinutes < ADAPTIVE_POLLING_CONFIG.ETA_TRANSITION_MINUTES;
}

/**
 * Determine the ideal tracking phase with hysteresis.
 */
export function determinePhase(
    distanceMeters: number,
    speedKmh: number,
    fromPhase: TrackingPhase,
    geofenceSetupFailed: boolean = false,
): TrackingPhase {
    if (shouldEnterActiveTracking(distanceMeters, speedKmh)) {
        return 'ACTIVE_TRACKING';
    }

    if (fromPhase === 'ACTIVE_TRACKING') {
        return distanceMeters > PHASE_BOUNDARIES.ACTIVE_EXIT_BUFFER
            ? 'ADAPTIVE_POLLING'
            : 'ACTIVE_TRACKING';
    }

    if (distanceMeters <= PHASE_BOUNDARIES.GEOFENCING_RADIUS) {
        return 'ADAPTIVE_POLLING';
    }

    if (fromPhase === 'ADAPTIVE_POLLING') {
        if (geofenceSetupFailed) {
            return 'ADAPTIVE_POLLING';
        }
        return distanceMeters > PHASE_BOUNDARIES.GEOFENCING_EXIT_BUFFER
            ? 'GEOFENCING'
            : 'ADAPTIVE_POLLING';
    }

    return 'GEOFENCING';
}

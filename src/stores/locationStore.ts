/**
 * Location Store - Zustand state management for location tracking
 */

import { create } from 'zustand';
import * as Location from 'expo-location';
import { smartInterval } from '../styles/theme';

export type LocationPhase = 'rest' | 'approach' | 'prepare' | 'target';

interface LocationState {
    // Current location
    currentLocation: Location.LocationObject | null;
    accuracy: number | null;
    speed: number | null;

    // Tracking state
    isTracking: boolean;
    currentPhase: LocationPhase;
    distanceToTarget: number | null;

    // Target
    targetLocation: { latitude: number; longitude: number } | null;
    targetRadius: number;

    // Permissions
    hasPermission: boolean;
    permissionStatus: Location.PermissionStatus | null;

    // Actions
    requestPermissions: () => Promise<boolean>;
    startTracking: (target: { latitude: number; longitude: number }, radius: number) => Promise<void>;
    stopTracking: () => void;
    updateLocation: (location: Location.LocationObject) => void;
    calculatePhase: (distance: number, speed: number) => LocationPhase;
    getCheckInterval: () => number;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

export const useLocationStore = create<LocationState>((set, get) => ({
    currentLocation: null,
    accuracy: null,
    speed: null,
    isTracking: false,
    currentPhase: 'rest',
    distanceToTarget: null,
    targetLocation: null,
    targetRadius: 500,
    hasPermission: false,
    permissionStatus: null,

    requestPermissions: async () => {
        try {
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

            if (foregroundStatus !== 'granted') {
                set({ hasPermission: false, permissionStatus: foregroundStatus });
                return false;
            }

            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

            set({
                hasPermission: backgroundStatus === 'granted',
                permissionStatus: backgroundStatus,
            });

            return backgroundStatus === 'granted';
        } catch (error: any) {
            console.error('[LocationStore] Permission request failed:', error);

            // Handle Expo Go environment where Info.plist keys may not be available
            if (error?.message?.includes('NSLocation') || error?.message?.includes('Info.plist')) {
                console.warn('[LocationStore] Running in Expo Go - permissions not available');
                // Set hasPermission to true to allow testing other features
                set({ hasPermission: false, permissionStatus: Location.PermissionStatus.UNDETERMINED });
            }

            return false;
        }
    },

    startTracking: async (target, radius) => {
        const { hasPermission, requestPermissions } = get();

        if (!hasPermission) {
            const granted = await requestPermissions();
            if (!granted) {
                console.warn('[LocationStore] Cannot start tracking without permissions');
                return;
            }
        }

        set({
            targetLocation: target,
            targetRadius: radius,
            isTracking: true,
        });

        console.log('[LocationStore] Started tracking to target:', target);
    },

    stopTracking: () => {
        set({
            isTracking: false,
            currentPhase: 'rest',
            distanceToTarget: null,
            targetLocation: null,
        });
        console.log('[LocationStore] Stopped tracking');
    },

    updateLocation: (location) => {
        const { targetLocation, targetRadius } = get();

        const speed = location.coords.speed ?? 0;
        const speedKmh = (speed * 3600) / 1000; // Convert m/s to km/h

        let distance: number | null = null;
        let phase: LocationPhase = 'rest';

        if (targetLocation) {
            distance = calculateDistance(
                location.coords.latitude,
                location.coords.longitude,
                targetLocation.latitude,
                targetLocation.longitude
            );
            phase = get().calculatePhase(distance, speedKmh);
        }

        set({
            currentLocation: location,
            accuracy: location.coords.accuracy,
            speed: speedKmh,
            distanceToTarget: distance,
            currentPhase: phase,
        });

        // Check if arrived
        if (distance !== null && distance <= targetRadius) {
            console.log('[LocationStore] ARRIVED! Distance:', distance);
            // Trigger alarm logic will be handled separately
        }
    },

    calculatePhase: (distance: number, speed: number): LocationPhase => {
        // Adjust distance for high-speed travel (KTX, etc.)
        const adjustedDistance = speed > smartInterval.highSpeedThreshold
            ? distance * smartInterval.highSpeedMultiplier
            : distance;

        if (adjustedDistance > smartInterval.restPhase.distance) return 'rest';
        if (adjustedDistance > smartInterval.approachPhase.distance) return 'approach';
        if (adjustedDistance > smartInterval.preparePhase.distance) return 'prepare';
        return 'target';
    },

    getCheckInterval: () => {
        const { currentPhase } = get();

        switch (currentPhase) {
            case 'rest':
                return smartInterval.restPhase.interval;
            case 'approach':
                return smartInterval.approachPhase.interval;
            case 'prepare':
                return smartInterval.preparePhase.interval;
            case 'target':
                return 0; // Use distance filter instead
            default:
                return smartInterval.restPhase.interval;
        }
    },
}));

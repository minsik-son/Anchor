/**
 * Location Store - Zustand state management for location tracking
 */

import { create } from 'zustand';
import * as Location from 'expo-location';
import { smartInterval } from '../styles/theme';
import { stopBackgroundLocation } from '../services/location/locationService';
import { isWithinRadius } from '../services/location/geofence';

export type LocationPhase = 'rest' | 'approach' | 'prepare' | 'target';
export type TransportMode = 'driving' | 'transit' | 'walking' | 'cycling';

export interface RouteInfo {
    id: string;
    name: string;  // "추천 경로", "최단 시간", etc.
    duration: number;  // minutes
    distance: number;  // meters
    eta: string;  // "14:30"
    coordinates: { latitude: number; longitude: number }[];
}

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

    // Navigation state
    isNavigating: boolean;
    transportMode: TransportMode;
    routes: RouteInfo[];
    selectedRoute: RouteInfo | null;
    startLocation: { latitude: number; longitude: number } | null;

    // Actions
    requestPermissions: () => Promise<boolean>;
    getCurrentLocation: () => Promise<Location.LocationObject | null>;
    startTracking: (target: { latitude: number; longitude: number }, radius: number) => Promise<void>;
    stopTracking: () => void;
    updateLocation: (location: Location.LocationObject) => void;
    checkGeofence: () => boolean;
    calculatePhase: (distance: number, speed: number) => LocationPhase;
    getCheckInterval: () => number;

    // Navigation actions
    setTransportMode: (mode: TransportMode) => void;
    setRoutes: (routes: RouteInfo[]) => void;
    selectRoute: (routeId: string) => void;
    setStartLocation: (location: { latitude: number; longitude: number } | null) => void;
    startNavigation: () => void;
    stopNavigation: () => void;
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

    // Navigation initial state
    isNavigating: false,
    transportMode: 'driving',
    routes: [],
    selectedRoute: null,
    startLocation: null,

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
            // Handle Expo Go environment where Info.plist keys may not be available
            if (error?.message?.includes('NSLocation') || error?.message?.includes('Info.plist')) {
                console.warn('[LocationStore] Running in Expo Go - location permissions not available. This is expected.');
                // Set hasPermission to false but allow testing other features
                set({ hasPermission: false, permissionStatus: Location.PermissionStatus.UNDETERMINED });
            } else {
                console.error('[LocationStore] Permission request failed:', error);
            }

            return false;
        }
    },

    getCurrentLocation: async () => {
        try {
            // Try to get current position
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            // Update store with this location
            set({ currentLocation: location });

            return location;
        } catch (error: any) {
            console.warn('[LocationStore] getCurrentPositionAsync failed, trying last known position:', error?.message);

            try {
                // Fallback to last known position
                const lastKnown = await Location.getLastKnownPositionAsync();
                if (lastKnown) {
                    set({ currentLocation: lastKnown });
                    return lastKnown;
                }
            } catch (fallbackError) {
                console.warn('[LocationStore] getLastKnownPositionAsync also failed');
            }

            return null;
        }
    },

    startTracking: async (target, radius) => {
        const { hasPermission, requestPermissions, currentLocation } = get();

        if (!hasPermission) {
            const granted = await requestPermissions();
            if (!granted) {
                console.warn('[LocationStore] Cannot start tracking without permissions');
                return;
            }
        }

        // Calculate initial distance if we already have a location
        let initialDistance: number | null = null;
        if (currentLocation) {
            initialDistance = calculateDistance(
                currentLocation.coords.latitude,
                currentLocation.coords.longitude,
                target.latitude,
                target.longitude
            );
        }

        set({
            targetLocation: target,
            targetRadius: radius,
            isTracking: true,
            distanceToTarget: initialDistance,
        });

        console.log('[LocationStore] Started tracking to target:', target, 'initial distance:', initialDistance);
    },

    stopTracking: () => {
        // Stop background location updates
        stopBackgroundLocation().catch((err) => {
            console.warn('[LocationStore] Failed to stop background location:', err);
        });

        set({
            isTracking: false,
            currentPhase: 'rest',
            distanceToTarget: null,
            targetLocation: null,
        });
        console.log('[LocationStore] Stopped tracking');
    },

    checkGeofence: () => {
        const { currentLocation, targetLocation, targetRadius } = get();
        if (!currentLocation || !targetLocation) return false;

        const userPos = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
        };
        return isWithinRadius(userPos, targetLocation, targetRadius);
    },

    updateLocation: (location) => {
        const { targetLocation } = get();

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

    // Navigation actions
    setTransportMode: (mode) => {
        set({ transportMode: mode });
    },

    setRoutes: (routes) => {
        set({ routes });
    },

    selectRoute: (routeId) => {
        const { routes } = get();
        const selectedRoute = routes.find(r => r.id === routeId) || null;
        set({ selectedRoute });
    },

    setStartLocation: (location) => {
        set({ startLocation: location });
    },

    startNavigation: () => {
        const { selectedRoute } = get();
        if (!selectedRoute) {
            console.warn('[LocationStore] Cannot start navigation without selected route');
            return;
        }
        set({ isNavigating: true });
        console.log('[LocationStore] Navigation started with route:', selectedRoute.name);
    },

    stopNavigation: () => {
        set({
            isNavigating: false,
            selectedRoute: null,
            routes: [],
            startLocation: null,
        });
        console.log('[LocationStore] Navigation stopped');
    },
}));

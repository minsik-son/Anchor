/**
 * Location Store - Zustand state management for location tracking
 */

import { create } from 'zustand';
import * as Location from 'expo-location';
import { stopAllTracking } from '../services/location/locationService';
import { calculateDistance, isWithinRadius } from '../services/location/geofence';

export type TrackingPhase = 'IDLE' | 'GEOFENCING' | 'ADAPTIVE_POLLING' | 'ACTIVE_TRACKING';
export type TransportMode = 'driving' | 'transit' | 'walking' | 'cycling';

export interface RoutePoint {
    latitude: number;
    longitude: number;
    timestamp: number;
}

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
    currentPhase: TrackingPhase;
    distanceToTarget: number | null;
    trackingStartedAt: string | null;

    // Target
    targetLocation: { latitude: number; longitude: number } | null;
    targetRadius: number;

    // Route history for tracking detail
    routeHistory: RoutePoint[];
    traveledDistance: number;

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
    startTracking: (target: { latitude: number; longitude: number }, radius: number, initialLocation?: Location.LocationObject) => Promise<void>;
    stopTracking: () => void;
    updateLocation: (location: Location.LocationObject) => void;
    checkGeofence: () => boolean;
    setPhase: (phase: TrackingPhase) => void;
    addRoutePoint: (point: RoutePoint) => void;
    clearRouteHistory: () => void;

    // Navigation actions
    setTransportMode: (mode: TransportMode) => void;
    setRoutes: (routes: RouteInfo[]) => void;
    selectRoute: (routeId: string) => void;
    setStartLocation: (location: { latitude: number; longitude: number } | null) => void;
    startNavigation: () => void;
    stopNavigation: () => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
    currentLocation: null,
    accuracy: null,
    speed: null,
    isTracking: false,
    currentPhase: 'IDLE',
    distanceToTarget: null,
    trackingStartedAt: null,
    targetLocation: null,
    targetRadius: 500,
    routeHistory: [],
    traveledDistance: 0,
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
                set({ hasPermission: false, permissionStatus: Location.PermissionStatus.UNDETERMINED });
            } else {
                console.error('[LocationStore] Permission request failed:', error);
            }

            return false;
        }
    },

    getCurrentLocation: async () => {
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            set({ currentLocation: location });

            return location;
        } catch (error: any) {
            console.warn('[LocationStore] getCurrentPositionAsync failed, trying last known position:', error?.message);

            try {
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

    startTracking: async (target, radius, initialLocation) => {
        const { hasPermission, requestPermissions, currentLocation } = get();

        if (!hasPermission) {
            const granted = await requestPermissions();
            if (!granted) {
                console.warn('[LocationStore] Cannot start tracking without permissions');
                return;
            }
        }

        // Use provided location (guaranteed fresh) or fall back to store
        const loc = initialLocation || currentLocation;

        let initialDistance: number | null = null;
        if (loc) {
            initialDistance = calculateDistance(
                { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
                target
            );
        }

        get().clearRouteHistory();

        set({
            targetLocation: target,
            targetRadius: radius,
            isTracking: true,
            currentPhase: 'IDLE',
            distanceToTarget: initialDistance,
            trackingStartedAt: new Date().toISOString(),
            ...(initialLocation ? { currentLocation: initialLocation } : {}),
        });

        console.log('[LocationStore] Started tracking to target:', target, 'initial distance:', initialDistance);
    },

    stopTracking: () => {
        stopAllTracking().catch((err) => {
            console.warn('[LocationStore] Failed to stop tracking:', err);
        });

        set({
            isTracking: false,
            currentPhase: 'IDLE',
            distanceToTarget: null,
            targetLocation: null,
            trackingStartedAt: null,
            routeHistory: [],
            traveledDistance: 0,
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
        const speedKmh = (speed * 3600) / 1000;

        let distance: number | null = null;
        if (targetLocation) {
            distance = calculateDistance(
                { latitude: location.coords.latitude, longitude: location.coords.longitude },
                targetLocation
            );
        }

        set({
            currentLocation: location,
            accuracy: location.coords.accuracy,
            speed: speedKmh,
            distanceToTarget: distance,
        });
    },

    setPhase: (phase) => set({ currentPhase: phase }),

    addRoutePoint: (point) => {
        const { routeHistory, traveledDistance } = get();
        let newDistance = traveledDistance;

        // Calculate incremental distance from last point
        if (routeHistory.length > 0) {
            const lastPoint = routeHistory[routeHistory.length - 1];
            const dist = calculateDistance(
                { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
                { latitude: point.latitude, longitude: point.longitude }
            );
            newDistance += dist;
        }

        set({
            routeHistory: [...routeHistory, point],
            traveledDistance: newDistance,
        });
    },

    clearRouteHistory: () => {
        set({
            routeHistory: [],
            traveledDistance: 0,
        });
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

/**
 * useMapAnimation Hook
 * Encapsulates map animation pattern extracted from home.tsx
 */

import { useRef, useCallback } from 'react';
import MapView from 'react-native-maps';

export function useMapAnimation() {
    const mapRef = useRef<MapView>(null);
    const isAnimatingRef = useRef(false);

    const animateToLocation = useCallback((
        location: { latitude: number; longitude: number },
        duration = 500,
    ) => {
        if (!mapRef.current) return;
        isAnimatingRef.current = true;
        mapRef.current.animateToRegion({
            ...location,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        }, duration);
        setTimeout(() => {
            isAnimatingRef.current = false;
        }, duration + 50);
    }, []);

    return { mapRef, isAnimatingRef, animateToLocation };
}

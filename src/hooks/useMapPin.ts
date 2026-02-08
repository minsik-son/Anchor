import { useState, useRef, useCallback, useEffect } from 'react';
import { Keyboard, Animated } from 'react-native';
import MapView, { Region, Details } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { debouncedReverseGeocode, GeocodingResult } from '../services/geocoding';

interface UseMapPinProps {
    mapRef: React.RefObject<MapView | null>;
    initialLocation: { latitude: number; longitude: number } | null;
    onLocationChange?: (location: { latitude: number; longitude: number }) => void;
    onAddressChange?: (address: GeocodingResult) => void;
}

export const useMapPin = ({
    mapRef,
    initialLocation,
    onLocationChange,
    onAddressChange,
}: UseMapPinProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [centerLocation, setCenterLocation] = useState<{ latitude: number; longitude: number } | null>(initialLocation);
    const [addressInfo, setAddressInfo] = useState<GeocodingResult>({ address: '' });
    const [isLoadingAddress, setIsLoadingAddress] = useState(false);

    // Internal tracking refs
    const isDraggingRef = useRef(false);
    const isAnimatingRef = useRef(false);

    // Initial sync
    useEffect(() => {
        if (initialLocation && !centerLocation) {
            setCenterLocation(initialLocation);
        }
    }, [initialLocation]);

    // Handle immediate lift on drag
    const handlePanDrag = useCallback(() => {
        if (isAnimatingRef.current) return;

        if (!isDraggingRef.current) {
            isDraggingRef.current = true;
            setIsDragging(true);
            setIsLoadingAddress(true);
            Keyboard.dismiss();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, []);

    // Safety backup for gesture detection
    const handleRegionChange = useCallback((_region: Region, details: Details) => {
        if (details?.isGesture && !isDraggingRef.current && !isAnimatingRef.current) {
            isDraggingRef.current = true;
            setIsDragging(true);
            setIsLoadingAddress(true);
        }
    }, []);

    // Finalize location and trigger reverse geocoding
    const handleRegionChangeComplete = useCallback((region: Region) => {
        isDraggingRef.current = false;
        setIsDragging(false);

        const newLocation = {
            latitude: region.latitude,
            longitude: region.longitude,
        };

        setCenterLocation(newLocation);
        onLocationChange?.(newLocation);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Reverse geocode
        setIsLoadingAddress(true);
        debouncedReverseGeocode(region.latitude, region.longitude, (result) => {
            setAddressInfo(result);
            onAddressChange?.(result);
            setIsLoadingAddress(false);
        });
    }, [onLocationChange, onAddressChange]);

    // Programmatic move with animation protection
    const moveToLocation = useCallback(async (
        location: { latitude: number; longitude: number },
        duration = 500,
        delta = 0.01
    ) => {
        if (!mapRef.current) return;

        isAnimatingRef.current = true;
        mapRef.current.animateToRegion({
            ...location,
            latitudeDelta: delta,
            longitudeDelta: delta,
        }, duration);

        setCenterLocation(location);
        onLocationChange?.(location);

        // Geocode the destination
        setIsLoadingAddress(true);
        debouncedReverseGeocode(location.latitude, location.longitude, (result) => {
            setAddressInfo(result);
            onAddressChange?.(result);
            setIsLoadingAddress(false);
        });

        setTimeout(() => {
            isAnimatingRef.current = false;
        }, duration + 50);
    }, [mapRef, onLocationChange, onAddressChange]);

    return {
        isDragging,
        centerLocation,
        addressInfo,
        isLoadingAddress,
        isAnimatingRef,
        isDraggingRef,
        handlers: {
            handlePanDrag,
            handleRegionChange,
            handleRegionChangeComplete,
        },
        actions: {
            setCenterLocation,
            setAddressInfo,
            setIsLoadingAddress,
            moveToLocation,
        }
    };
};

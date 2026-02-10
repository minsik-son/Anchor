import { useState, useRef, useCallback, useEffect } from 'react';
import { Keyboard } from 'react-native';
import MapView, { Region, Details } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { debouncedReverseGeocode, GeocodingResult } from '../services/geocoding';
import { BOTTOM_SHEET_COLLAPSED } from '../components/home/BottomSheetDashboard';

interface UseMapPinProps {
    mapRef: React.RefObject<MapView | null>;
    initialLocation: { latitude: number; longitude: number } | null;
    onLocationChange?: (location: { latitude: number; longitude: number }) => void;
    onAddressChange?: (address: GeocodingResult) => void;
    screenHeight: number;
    getBottomSheetHeight: () => number;
}

// Helper: Convert pixel offset to latitude
const pixelToLatitude = (
    pixelOffset: number,
    screenHeight: number,
    latitudeDelta: number
): number => {
    return (pixelOffset / screenHeight) * latitudeDelta;
};

export const useMapPin = ({
    mapRef,
    initialLocation,
    onLocationChange,
    onAddressChange,
    screenHeight,
    getBottomSheetHeight,
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

        // Calculate coordinate offset based on bottom sheet expansion
        const sheetHeight = getBottomSheetHeight();
        const sheetExpansion = sheetHeight - BOTTOM_SHEET_COLLAPSED;
        const pixelOffset = sheetExpansion / 2;
        const latOffset = pixelToLatitude(pixelOffset, screenHeight, region.latitudeDelta);

        const newLocation = {
            latitude: region.latitude - latOffset,  // Shift down to match visual pin position
            longitude: region.longitude,
        };

        setCenterLocation(newLocation);
        onLocationChange?.(newLocation);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Reverse geocode with offset-adjusted location
        setIsLoadingAddress(true);
        debouncedReverseGeocode(newLocation.latitude, newLocation.longitude, (result) => {
            setAddressInfo(result);
            onAddressChange?.(result);
            setIsLoadingAddress(false);
        });
    }, [onLocationChange, onAddressChange, screenHeight, getBottomSheetHeight]);

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

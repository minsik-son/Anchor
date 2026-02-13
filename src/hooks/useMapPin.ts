import { useState, useRef, useCallback, useEffect } from 'react';
import { Keyboard } from 'react-native';
import MapView, { Region, Details } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { debouncedReverseGeocode, GeocodingResult } from '../services/geocoding';

interface UseMapPinProps {
    mapRef: React.RefObject<MapView | null>;
    initialLocation: { latitude: number; longitude: number } | null;
    onLocationChange?: (location: { latitude: number; longitude: number }) => void;
    onAddressChange?: (address: GeocodingResult) => void;
    mapHeight: number;
    screenWidth: number;
    getBottomSheetHeight: () => number;
}

// Pin tip offset from screen center (matches CenterPinMarker geometry)
// Container has marginTop: -28, pin sits at bottom of container
const PIN_TIP_OFFSET = 28;

export const useMapPin = ({
    mapRef,
    initialLocation,
    onLocationChange,
    onAddressChange,
    mapHeight,
    screenWidth,
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
    // 2-phase approach: immediate render with region coords, then refine with precise coords
    const handleRegionChangeComplete = useCallback((region: Region) => {
        isDraggingRef.current = false;

        // Phase 1: Immediate Circle rendering using region coordinates
        const immediateLocation = {
            latitude: region.latitude,
            longitude: region.longitude,
        };
        setCenterLocation(immediateLocation);
        setIsDragging(false);
        onLocationChange?.(immediateLocation);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Phase 2: Async refinement with precise coordinates
        const refineLocation = async () => {
            const pinTipInMapView = {
                x: screenWidth / 2,
                y: mapHeight / 2 + PIN_TIP_OFFSET,
            };

            try {
                const coordinate = await mapRef.current?.coordinateForPoint(pinTipInMapView);
                if (coordinate) {
                    const refinedLocation = {
                        latitude: coordinate.latitude,
                        longitude: coordinate.longitude,
                    };
                    setCenterLocation(refinedLocation);
                    onLocationChange?.(refinedLocation);

                    // Geocoding with precise coordinates
                    debouncedReverseGeocode(refinedLocation.latitude, refinedLocation.longitude, (result) => {
                        setAddressInfo(result);
                        onAddressChange?.(result);
                        setIsLoadingAddress(false);
                    });
                } else {
                    // Fallback: geocode with region coordinates
                    debouncedReverseGeocode(immediateLocation.latitude, immediateLocation.longitude, (result) => {
                        setAddressInfo(result);
                        onAddressChange?.(result);
                        setIsLoadingAddress(false);
                    });
                }
            } catch {
                // Fallback: geocode with region coordinates
                debouncedReverseGeocode(immediateLocation.latitude, immediateLocation.longitude, (result) => {
                    setAddressInfo(result);
                    onAddressChange?.(result);
                    setIsLoadingAddress(false);
                });
            }
        };

        refineLocation();
    }, [mapRef, onLocationChange, onAddressChange, screenWidth, mapHeight]);

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

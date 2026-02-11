/**
 * CenterPinMarker Component
 * Fixed pin at screen center with drag animations and vertical offset
 * Syncs with BottomSheetDashboard to stay centered in visible map area
 */

import { useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated as RNAnimated } from 'react-native';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { shadows, useThemeColors, ThemeColors } from '../../styles/theme';
import { BOTTOM_SHEET_COLLAPSED } from '../home/BottomSheetDashboard';

interface CenterPinMarkerProps {
    isDragging: boolean;
    bottomSheetHeight: SharedValue<number>;
    screenHeight: number;
}

export default function CenterPinMarker({
    isDragging,
    bottomSheetHeight,
    screenHeight,
}: CenterPinMarkerProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // RN Animated values for drag animation
    const translateY = useRef(new RNAnimated.Value(0)).current;
    const scale = useRef(new RNAnimated.Value(1)).current;
    const shadowOpacity = useRef(new RNAnimated.Value(0.15)).current;
    const shadowScale = useRef(new RNAnimated.Value(1)).current;

    // Drag animation using RN Animated API
    useEffect(() => {
        if (isDragging) {
            // Pin Lift: responsive but firm
            RNAnimated.parallel([
                RNAnimated.spring(translateY, {
                    toValue: -15,
                    tension: 300,
                    friction: 15,
                    useNativeDriver: true,
                }),
                RNAnimated.spring(scale, {
                    toValue: 1.1,
                    tension: 300,
                    friction: 15,
                    useNativeDriver: true,
                }),
                RNAnimated.spring(shadowOpacity, {
                    toValue: 0.3,
                    tension: 300,
                    friction: 15,
                    useNativeDriver: true,
                }),
                RNAnimated.spring(shadowScale, {
                    toValue: 1.5,
                    tension: 300,
                    friction: 15,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Pin Drop: snappier for solid landing
            RNAnimated.parallel([
                RNAnimated.spring(translateY, {
                    toValue: 0,
                    tension: 400,
                    friction: 8,
                    useNativeDriver: true,
                }),
                RNAnimated.spring(scale, {
                    toValue: 1,
                    tension: 400,
                    friction: 8,
                    useNativeDriver: true,
                }),
                RNAnimated.spring(shadowOpacity, {
                    toValue: 0.15,
                    tension: 400,
                    friction: 8,
                    useNativeDriver: true,
                }),
                RNAnimated.spring(shadowScale, {
                    toValue: 1,
                    tension: 400,
                    friction: 8,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isDragging, translateY, scale, shadowOpacity, shadowScale]);

    // Derive vertical offset from bottom sheet height (Reanimated for SharedValue sync)
    const containerStyle = useAnimatedStyle(() => {
        const sheetExpansion = bottomSheetHeight.value - BOTTOM_SHEET_COLLAPSED;
        const verticalOffset = sheetExpansion / 2;
        return {
            transform: [{ translateY: -verticalOffset }],
        };
    });

    return (
        <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
            {/* Pin Shadow */}
            <RNAnimated.View
                style={[
                    styles.shadow,
                    {
                        opacity: shadowOpacity,
                        transform: [{ scaleX: shadowScale }, { scaleY: 0.5 }],
                    },
                ]}
            />

            {/* Pin Icon */}
            <RNAnimated.View
                style={[
                    styles.pinContainer,
                    { transform: [{ translateY }, { scale }] },
                ]}
            >
                <View style={styles.pinHead}>
                    <Ionicons name="location" size={32} color={colors.surface} />
                </View>
                <View style={styles.pinTail} />
            </RNAnimated.View>
        </Animated.View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -24,
        marginTop: -28,
        width: 48,
        height: 56,
        alignItems: 'center',
        justifyContent: 'flex-end',
        zIndex: 100,
    },
    pinContainer: {
        alignItems: 'center',
    },
    pinHead: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.button,
    },
    pinTail: {
        width: 4,
        height: 12,
        backgroundColor: colors.primary,
        borderBottomLeftRadius: 2,
        borderBottomRightRadius: 2,
        marginTop: -4,
    },
    shadow: {
        position: 'absolute',
        bottom: -8,
        width: 20,
        height: 8,
        borderRadius: 10,
        backgroundColor: '#000',
    },
});

/**
 * CenterPinMarker Component
 * Fixed pin at screen center with drag animations
 * Using React Native's built-in Animated API for Expo Go compatibility
 */

import { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors as defaultColors, shadows, useThemeColors, ThemeColors } from '../../styles/theme';

interface CenterPinMarkerProps {
    isDragging: boolean;
}

export default function CenterPinMarker({ isDragging }: CenterPinMarkerProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const translateY = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;
    const shadowOpacity = useRef(new Animated.Value(0.15)).current;
    const shadowScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isDragging) {
            // Lift pin up
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: -15,
                    useNativeDriver: true,
                    tension: 300,
                    friction: 15,
                }),
                Animated.spring(scale, {
                    toValue: 1.1,
                    useNativeDriver: true,
                    tension: 300,
                    friction: 15,
                }),
                Animated.timing(shadowOpacity, {
                    toValue: 0.3,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(shadowScale, {
                    toValue: 1.5,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Drop pin with bounce
            Animated.parallel([
                Animated.sequence([
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 400,
                        friction: 8,
                    }),
                ]),
                Animated.spring(scale, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 300,
                    friction: 15,
                }),
                Animated.timing(shadowOpacity, {
                    toValue: 0.15,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(shadowScale, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isDragging]);

    return (
        <View style={styles.container} pointerEvents="none">
            {/* Pin Shadow */}
            <Animated.View
                style={[
                    styles.shadow,
                    {
                        opacity: shadowOpacity,
                        transform: [{ scaleX: shadowScale }, { scaleY: 0.5 }],
                    }
                ]}
            />

            {/* Pin Icon */}
            <Animated.View
                style={[
                    styles.pinContainer,
                    {
                        transform: [{ translateY }, { scale }]
                    }
                ]}
            >
                <View style={styles.pinHead}>
                    <Ionicons name="location" size={32} color={colors.surface} />
                </View>
                <View style={styles.pinTail} />
            </Animated.View>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -24,
        marginTop: -28, // Adjusted to center the pin body (User reported it was too high at -56)
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
        backgroundColor: colors.textStrong,
    },
});

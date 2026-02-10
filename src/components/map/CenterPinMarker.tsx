/**
 * CenterPinMarker Component
 * Fixed pin at screen center with drag animations and vertical offset
 * Syncs with BottomSheetDashboard to stay centered in visible map area
 */

import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useDerivedValue,
    withSpring,
    interpolate,
    SharedValue,
} from 'react-native-reanimated';
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

    // Derive vertical offset from bottom sheet height
    // Pin shifts up by half the sheet expansion to stay centered in visible area
    const containerStyle = useAnimatedStyle(() => {
        const sheetExpansion = bottomSheetHeight.value - BOTTOM_SHEET_COLLAPSED;
        const verticalOffset = sheetExpansion / 2;
        return {
            transform: [{ translateY: -verticalOffset }],
        };
    });

    // Convert isDragging boolean to animated values using useDerivedValue
    const dragProgress = useDerivedValue(() =>
        withSpring(isDragging ? 1 : 0, { damping: 15, stiffness: 300 })
    );

    const pinStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: interpolate(dragProgress.value, [0, 1], [0, -15]) },
            { scale: interpolate(dragProgress.value, [0, 1], [1, 1.1]) },
        ],
    }));

    const shadowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(dragProgress.value, [0, 1], [0.15, 0.3]),
        transform: [
            { scaleX: interpolate(dragProgress.value, [0, 1], [1, 1.5]) },
            { scaleY: 0.5 },
        ],
    }));

    return (
        <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
            {/* Pin Shadow */}
            <Animated.View style={[styles.shadow, shadowStyle]} />

            {/* Pin Icon */}
            <Animated.View style={[styles.pinContainer, pinStyle]}>
                <View style={styles.pinHead}>
                    <Ionicons name="location" size={32} color={colors.surface} />
                </View>
                <View style={styles.pinTail} />
            </Animated.View>
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

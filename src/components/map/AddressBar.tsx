/**
 * AddressBar Component
 * Real-time address display with skeleton loading
 * Using React Native's built-in Animated API for Expo Go compatibility
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius, shadows } from '../../styles/theme';

interface AddressBarProps {
    address: string;
    detail?: string;
    isLoading: boolean;
}

export default function AddressBar({ address, detail, isLoading }: AddressBarProps) {
    const shimmerOpacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        if (isLoading) {
            const animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(shimmerOpacity, {
                        toValue: 0.7,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(shimmerOpacity, {
                        toValue: 0.3,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            );
            animation.start();
            return () => animation.stop();
        }
    }, [isLoading]);

    if (isLoading) {
        return (
            <View style={styles.container}>
                <View style={styles.iconContainer}>
                    <Ionicons name="location" size={20} color={colors.primary} />
                </View>
                <View style={styles.contentContainer}>
                    <Animated.View style={[styles.skeletonLine, styles.skeletonLong, { opacity: shimmerOpacity }]} />
                    <Animated.View style={[styles.skeletonLine, styles.skeletonShort, { opacity: shimmerOpacity }]} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <Ionicons name="location" size={20} color={colors.primary} />
            </View>
            <View style={styles.contentContainer}>
                <Text style={styles.address} numberOfLines={1}>
                    {address || '위치를 선택해주세요'}
                </Text>
                {detail && (
                    <Text style={styles.detail} numberOfLines={1}>
                        {detail}
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        gap: spacing.xs,
        ...shadows.card,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: radius.sm,
        backgroundColor: `${colors.primary}15`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentContainer: {
        flex: 1,
        gap: 2,
    },
    address: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
    },
    detail: {
        ...typography.caption,
        color: colors.textMedium,
    },
    skeletonLine: {
        height: 14,
        backgroundColor: colors.background,
        borderRadius: 4,
    },
    skeletonLong: {
        width: '80%',
    },
    skeletonShort: {
        width: '50%',
        marginTop: 4,
    },
});

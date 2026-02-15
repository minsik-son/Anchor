/**
 * BottomSheetDashboard Component
 * Gesture-driven, expandable bottom sheet for the Map screen
 * Uses react-native-gesture-handler and react-native-reanimated
 */

import { useMemo, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate,
    runOnJS,
    SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';

import AddressBar from '../map/AddressBar';
import { useThemeColors, ThemeColors, typography, spacing, radius, shadows } from '../../styles/theme';
import { FavoritePlace } from '../../stores/favoritePlaceStore';
import { useDistanceFormatter } from '../../utils/distanceFormatter';

// Non-linear radius steps: 50-150m (10m), 150-500m (50m), 500-1000m (100m)
export const RADIUS_STEPS: number[] = (() => {
    const steps: number[] = [];
    for (let v = 50; v <= 150; v += 10) steps.push(v);
    for (let v = 200; v <= 500; v += 50) steps.push(v);
    for (let v = 600; v <= 1000; v += 100) steps.push(v);
    return steps;
})();

export function radiusToIndex(radius: number): number {
    let closest = 0;
    let minDiff = Math.abs(RADIUS_STEPS[0] - radius);
    for (let i = 1; i < RADIUS_STEPS.length; i++) {
        const diff = Math.abs(RADIUS_STEPS[i] - radius);
        if (diff < minDiff) {
            minDiff = diff;
            closest = i;
        }
    }
    return closest;
}

export function indexToRadius(index: number): number {
    const clamped = Math.round(Math.max(0, Math.min(RADIUS_STEPS.length - 1, index)));
    return RADIUS_STEPS[clamped];
}

// Exported constants for synchronization with map pin
export const BOTTOM_SHEET_COLLAPSED = 248;
export const getBottomSheetExpanded = (screenHeight: number) => screenHeight * 0.5;

interface BottomSheetDashboardProps {
    animatedHeight: SharedValue<number>;
    centerLocation: { latitude: number; longitude: number } | null;
    addressInfo: { address: string; detail?: string };
    isLoadingAddress: boolean;
    selectedRadius: number;
    onRadiusChange: (value: number) => void;
    favorites: FavoritePlace[];
    onFavoritePress: (fav: FavoritePlace) => void;
    onFavoriteDelete: (id: string) => void;
    onAddFavorite: () => void;
    onCreateAlarm: () => void;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
}

const SPRING_CONFIG = {
    damping: 20,
    stiffness: 300,
    mass: 0.5,
    overshootClamping: true,
};

function BottomSheetDashboard({
    animatedHeight,
    centerLocation,
    addressInfo,
    isLoadingAddress,
    selectedRadius,
    onRadiusChange,
    favorites,
    onFavoritePress,
    onFavoriteDelete,
    onAddFavorite,
    onCreateAlarm,
    expanded = false,
    onExpandedChange,
}: BottomSheetDashboardProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { height: screenHeight } = useWindowDimensions();
    const { formatRadius, getRadiusLabels } = useDistanceFormatter();

    const EXPANDED_HEIGHT = getBottomSheetExpanded(screenHeight);

    const context = useSharedValue({ startHeight: BOTTOM_SHEET_COLLAPSED });
    const isExpanded = useSharedValue(false);

    // Delete mode state for favorites management
    const [isDeleteMode, setIsDeleteMode] = useState(false);

    const toggleDeleteMode = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsDeleteMode(prev => !prev);
    }, []);

    // Reset delete mode when sheet collapses
    useEffect(() => {
        if (!expanded && isDeleteMode) {
            setIsDeleteMode(false);
        }
    }, [expanded, isDeleteMode]);

    // Sync external expanded prop with internal state
    useEffect(() => {
        const targetHeight = expanded ? EXPANDED_HEIGHT : BOTTOM_SHEET_COLLAPSED;
        if (animatedHeight.value !== targetHeight) {
            animatedHeight.value = withSpring(targetHeight, SPRING_CONFIG);
            isExpanded.value = expanded;
        }
    }, [expanded, EXPANDED_HEIGHT]);

    const triggerHaptic = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const notifyExpandedChange = useCallback((expanded: boolean) => {
        onExpandedChange?.(expanded);
    }, [onExpandedChange]);

    const panGesture = Gesture.Pan()
        .onStart(() => {
            context.value = { startHeight: animatedHeight.value };
        })
        .onUpdate((e) => {
            // Drag UP (negative translationY) = increase height
            const newHeight = context.value.startHeight - e.translationY;
            animatedHeight.value = Math.max(BOTTOM_SHEET_COLLAPSED, Math.min(EXPANDED_HEIGHT, newHeight));
        })
        .onEnd((e) => {
            // Velocity UP (negative) or past midpoint = expand
            const midpoint = (BOTTOM_SHEET_COLLAPSED + EXPANDED_HEIGHT) / 2;
            const shouldExpand =
                e.velocityY < -500 ||
                (Math.abs(e.velocityY) <= 500 && animatedHeight.value > midpoint);

            animatedHeight.value = withSpring(
                shouldExpand ? EXPANDED_HEIGHT : BOTTOM_SHEET_COLLAPSED,
                SPRING_CONFIG
            );

            if (isExpanded.value !== shouldExpand) {
                isExpanded.value = shouldExpand;
                runOnJS(triggerHaptic)();
                runOnJS(notifyExpandedChange)(shouldExpand);
            }
        });

    const animatedContainerStyle = useAnimatedStyle(() => ({
        height: animatedHeight.value,
    }));

    const radiusSliderStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            animatedHeight.value,
            [BOTTOM_SHEET_COLLAPSED, EXPANDED_HEIGHT],
            [0, 1]
        ),
        maxHeight: interpolate(
            animatedHeight.value,
            [BOTTOM_SHEET_COLLAPSED, EXPANDED_HEIGHT],
            [0, 120]
        ),
        // Animate padding to 0 when collapsed to eliminate ghost space
        paddingVertical: interpolate(
            animatedHeight.value,
            [BOTTOM_SHEET_COLLAPSED, EXPANDED_HEIGHT],
            [0, spacing.xs]
        ),
        paddingHorizontal: interpolate(
            animatedHeight.value,
            [BOTTOM_SHEET_COLLAPSED, EXPANDED_HEIGHT],
            [0, spacing.md]
        ),
        // Animate margin to 0 when collapsed
        marginBottom: interpolate(
            animatedHeight.value,
            [BOTTOM_SHEET_COLLAPSED, EXPANDED_HEIGHT],
            [0, spacing.xs]
        ),
    }));

    // Header visibility (Edit button) - only in expanded state
    const favoritesHeaderStyle = useAnimatedStyle(() => ({
        opacity: interpolate(animatedHeight.value, [BOTTOM_SHEET_COLLAPSED, EXPANDED_HEIGHT], [0, 1]),
        maxHeight: interpolate(animatedHeight.value, [BOTTOM_SHEET_COLLAPSED, EXPANDED_HEIGHT], [0, 32]),
        marginBottom: interpolate(animatedHeight.value, [BOTTOM_SHEET_COLLAPSED, EXPANDED_HEIGHT], [0, spacing.xs]),
    }));

    // 10px bottom margin in collapsed state for visibility fix
    const favoritesContainerStyle = useAnimatedStyle(() => ({
        marginBottom: interpolate(animatedHeight.value, [BOTTOM_SHEET_COLLAPSED, EXPANDED_HEIGHT], [10, 0]),
    }));

    const radiusLabels = getRadiusLabels();

    const handleRadiusChipPress = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const shouldExpand = !isExpanded.value;
        animatedHeight.value = withSpring(
            shouldExpand ? EXPANDED_HEIGHT : BOTTOM_SHEET_COLLAPSED,
            SPRING_CONFIG
        );
        isExpanded.value = shouldExpand;
        notifyExpandedChange(shouldExpand);
    }, [EXPANDED_HEIGHT, notifyExpandedChange]);

    const handleFavoriteLongPress = useCallback((fav: FavoritePlace) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert(
            t('home.deleteFavorite.title'),
            t('home.deleteFavorite.message', { name: fav.label }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('home.deleteFavorite.confirm'),
                    style: 'destructive',
                    onPress: () => onFavoriteDelete(fav.id),
                },
            ]
        );
    }, [t, onFavoriteDelete]);

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.container, animatedContainerStyle]}>
                {/* Drag Handle */}
                <View style={styles.handleContainer}>
                    <View style={styles.handle} />
                </View>

                {/* Address Bar with Radius Chip */}
                <View style={styles.addressRow}>
                    <View style={styles.addressBarWrapper}>
                        <AddressBar
                            address={addressInfo.address}
                            detail={addressInfo.detail}
                            isLoading={isLoadingAddress}
                        />
                    </View>

                    {/* Radius Chip */}
                    {centerLocation && (
                        <Pressable
                            style={styles.radiusChip}
                            onPress={handleRadiusChipPress}
                        >
                            <Ionicons
                                name="radio-button-on"
                                size={14}
                                color={colors.primary}
                            />
                            <Text style={styles.radiusChipText}>
                                {formatRadius(selectedRadius)}
                            </Text>
                        </Pressable>
                    )}
                </View>

                {/* Radius Slider (visible when expanded) */}
                {centerLocation && (
                    <Animated.View style={[styles.radiusSliderContainer, radiusSliderStyle]}>
                        <View style={styles.radiusSliderHeader}>
                            <Text style={styles.radiusSliderLabel}>{t('alarmSetup.radius')}</Text>
                            <Text style={styles.radiusSliderValue}>{formatRadius(selectedRadius)}</Text>
                        </View>
                        <Slider
                            style={styles.radiusSlider}
                            minimumValue={0}
                            maximumValue={RADIUS_STEPS.length - 1}
                            step={1}
                            value={radiusToIndex(selectedRadius)}
                            onValueChange={(index: number) => onRadiusChange(indexToRadius(index))}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor={`${colors.textWeak}50`}
                            thumbTintColor={colors.primary}
                        />
                        <View style={styles.radiusSliderLabels}>
                            <Text style={styles.radiusSliderMinMax}>{radiusLabels.min}</Text>
                            <Text style={styles.radiusSliderMinMax}>{radiusLabels.max}</Text>
                        </View>
                    </Animated.View>
                )}

                {/* Create Alarm Button */}
                {centerLocation && (
                    <Pressable
                        style={({ pressed }) => [
                            styles.createButton,
                            pressed && styles.createButtonPressed,
                        ]}
                        onPress={onCreateAlarm}
                    >
                        <Text style={styles.createButtonText}>{t('home.createAlarm')}</Text>
                        <Ionicons name="arrow-forward" size={20} color={colors.surface} />
                    </Pressable>
                )}

                {/* Favorites Header with Manage Button (expanded only) */}
                <Animated.View style={[styles.favoritesHeader, favoritesHeaderStyle]}>
                    <Text style={styles.favoritesTitle}>{t('home.favorites')}</Text>
                    <Pressable style={styles.manageButton} onPress={toggleDeleteMode}>
                        <Text style={styles.manageButtonText}>
                            {isDeleteMode ? t('common.close') : t('common.edit')}
                        </Text>
                    </Pressable>
                </Animated.View>

                {/* Favorite Places */}
                <Animated.View style={[styles.quickActionsCompact, favoritesContainerStyle]}>
                    {favorites.map((fav) => (
                        <View key={fav.id} style={styles.favoriteChipWrapper}>
                            <Pressable
                                style={styles.quickChip}
                                onPress={() => onFavoritePress(fav)}
                                onLongPress={() => handleFavoriteLongPress(fav)}
                            >
                                <Ionicons name={fav.icon as any} size={16} color={colors.primary} />
                                <Text style={styles.quickChipLabel}>{fav.label}</Text>
                            </Pressable>

                            {/* X icon overlay in delete mode */}
                            {isDeleteMode && (
                                <Pressable
                                    style={styles.deleteIconOverlay}
                                    onPress={() => handleFavoriteLongPress(fav)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="close-circle" size={18} color={colors.error} />
                                </Pressable>
                            )}
                        </View>
                    ))}

                    {favorites.length < 10 && (
                        <Pressable style={styles.quickChipAdd} onPress={onAddFavorite}>
                            <Ionicons name="add" size={16} color={colors.textWeak} />
                            <Text style={styles.quickChipLabelAdd}>{t('home.favorites')}</Text>
                        </Pressable>
                    )}
                </Animated.View>
            </Animated.View>
        </GestureDetector>
    );
}

export default BottomSheetDashboard;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        padding: spacing.md,
        paddingTop: spacing.xs,
        paddingBottom: spacing.sm,
        ...shadows.card,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        elevation: 999,
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: spacing.xs,
        paddingBottom: spacing.sm,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
        gap: spacing.sm,
    },
    addressBarWrapper: {
        flex: 1,
    },
    radiusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        borderRadius: radius.full,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.border,
    },
    radiusChipText: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '700',
    },
    radiusSliderContainer: {
        backgroundColor: colors.background,
        borderRadius: radius.md,
        overflow: 'hidden',
        marginTop: spacing.xs,
        // padding and marginBottom removed - now animated in radiusSliderStyle
    },
    radiusSliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    radiusSliderLabel: {
        ...typography.caption,
        color: colors.textMedium,
        fontWeight: '600',
    },
    radiusSliderValue: {
        ...typography.heading,
        color: colors.primary,
        fontSize: 18,
    },
    radiusSlider: {
        width: '100%',
        height: 40,
    },
    radiusSliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    radiusSliderMinMax: {
        ...typography.caption,
        color: colors.textWeak,
        fontSize: 10,
    },
    createButton: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        gap: spacing.xs,
        height: 52,
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
        ...shadows.button,
    },
    createButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    createButtonText: {
        ...typography.body,
        color: colors.surface,
        fontWeight: '700',
        fontSize: 16,
    },
    quickActionsCompact: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    favoriteChipWrapper: {
        position: 'relative',
    },
    deleteIconOverlay: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.button,
    },
    favoritesHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
    },
    favoritesTitle: {
        ...typography.caption,
        color: colors.textMedium,
        fontWeight: '600',
    },
    manageButton: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 4,
    },
    manageButtonText: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '600',
    },
    quickChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        borderRadius: radius.md,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.border,
    },
    quickChipAdd: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        borderRadius: radius.md,
        gap: 6,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: colors.textWeak,
    },
    quickChipLabel: {
        ...typography.caption,
        color: colors.textStrong,
        fontWeight: '600',
    },
    quickChipLabelAdd: {
        ...typography.caption,
        color: colors.textWeak,
    },
});

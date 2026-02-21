/**
 * MapSearchBar Component
 * Reusable search bar with my-location button for map screens
 * Extracted from home.tsx for reuse in location-picker
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors, ThemeColors, typography, spacing, radius, shadows } from '../../styles/theme';

interface MapSearchBarProps {
    query: string;
    onQueryChange: (query: string) => void;
    onFocus?: () => void;
    onClear: () => void;
    onSubmit?: () => void;
    onMyLocationPress: () => void;
    /** Optional RN Animated.Value for opacity (e.g. fade during map drag) */
    animatedOpacity?: Animated.Value;
}

export default function MapSearchBar({
    query,
    onQueryChange,
    onFocus,
    onClear,
    onSubmit,
    onMyLocationPress,
    animatedOpacity,
}: MapSearchBarProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const searchBarStyle = animatedOpacity
        ? [styles.searchBar, { opacity: animatedOpacity }]
        : [styles.searchBar];

    return (
        <View style={styles.container}>
            <Animated.View style={searchBarStyle}>
                <Ionicons name="search" size={20} color={colors.textWeak} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={t('home.searchPlaceholder')}
                    placeholderTextColor={colors.textWeak}
                    value={query}
                    onChangeText={onQueryChange}
                    onFocus={onFocus}
                    onSubmitEditing={onSubmit}
                    returnKeyType="search"
                    accessibilityRole="search"
                    accessibilityLabel={t('accessibility.searchLocation')}
                />
                {query.length > 0 && (
                    <Pressable onPress={onClear}>
                        <Ionicons name="close-circle" size={20} color={colors.textWeak} />
                    </Pressable>
                )}
            </Animated.View>

            <Pressable
                style={styles.myLocationButton}
                onPress={onMyLocationPress}
                accessibilityRole="button"
                accessibilityLabel={t('accessibility.myLocation')}
            >
                <Ionicons name="locate" size={24} color={colors.primary} />
            </Pressable>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        height: 48,
        gap: spacing.xs,
        ...shadows.card,
    },
    searchInput: {
        flex: 1,
        ...typography.body,
        color: colors.textStrong,
        height: '100%',
    },
    myLocationButton: {
        width: 48,
        height: 48,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.button,
    },
});

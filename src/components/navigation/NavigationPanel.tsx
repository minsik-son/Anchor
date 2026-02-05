/**
 * NavigationPanel Component
 * Floating bottom panel for navigation mode showing trip info
 */

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { useLocationStore } from '../../stores/locationStore';
import { colors as defaultColors, typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../../styles/theme';

interface NavigationPanelProps {
    onStopNavigation: () => void;
}

export default function NavigationPanel({ onStopNavigation }: NavigationPanelProps) {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const {
        distanceToTarget,
        speed,
        selectedRoute,
        targetRadius
    } = useLocationStore();

    const formatDistance = (meters: number | null) => {
        if (meters === null) return '--';
        if (meters >= 1000) {
            return `${(meters / 1000).toFixed(1)}km`;
        }
        return `${Math.round(meters)}m`;
    };

    const formatSpeed = (kmh: number | null) => {
        if (kmh === null || kmh < 0) return '--';
        return `${Math.round(kmh)}`;
    };

    const distanceToAlarm = distanceToTarget !== null
        ? Math.max(0, distanceToTarget - targetRadius)
        : null;

    const handleStop = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onStopNavigation();
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom + spacing.xs }]}>
            {/* Route Name */}
            {selectedRoute && (
                <View style={styles.routeHeader}>
                    <Text style={styles.routeName}>{selectedRoute.name}</Text>
                    <Text style={styles.eta}>{t('navigation.eta', { time: selectedRoute.eta })}</Text>
                </View>
            )}

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Ionicons name="navigate" size={20} color={colors.primary} />
                    <View>
                        <Text style={styles.statLabel}>{t('navigation.distance')}</Text>
                        <Text style={styles.statValue}>{formatDistance(distanceToTarget)}</Text>
                    </View>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                    <Ionicons name="speedometer" size={20} color={colors.primary} />
                    <View>
                        <Text style={styles.statLabel}>{t('navigation.speed')}</Text>
                        <Text style={styles.statValue}>{formatSpeed(speed)} <Text style={styles.statUnit}>km/h</Text></Text>
                    </View>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                    <Ionicons name="notifications" size={20} color={colors.warning} />
                    <View>
                        <Text style={styles.statLabel}>{t('navigation.toAlarm')}</Text>
                        <Text style={[styles.statValue, distanceToAlarm !== null && distanceToAlarm < 500 && styles.statValueWarning]}>
                            {formatDistance(distanceToAlarm)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Stop Button */}
            <Pressable
                style={({ pressed }) => [
                    styles.stopButton,
                    pressed && styles.stopButtonPressed,
                ]}
                onPress={handleStop}
            >
                <Ionicons name="close-circle" size={20} color={colors.surface} />
                <Text style={styles.stopButtonText}>{t('navigation.stopAlarm')}</Text>
            </Pressable>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        ...shadows.card,
    },
    routeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    routeName: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
    },
    eta: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '500',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: radius.md,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    statItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: colors.textWeak,
        opacity: 0.3,
    },
    statLabel: {
        ...typography.caption,
        color: colors.textWeak,
    },
    statValue: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '700',
    },
    statValueWarning: {
        color: colors.warning,
    },
    statUnit: {
        ...typography.caption,
        color: colors.textWeak,
        fontWeight: '400',
    },
    stopButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.error,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
    },
    stopButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    stopButtonText: {
        ...typography.body,
        color: colors.surface,
        fontWeight: '600',
    },
});

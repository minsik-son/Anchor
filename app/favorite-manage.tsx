/**
 * Favorite Places Management Screen
 * List of favorites with on/off toggles, edit, and delete
 */

import { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useFavoritePlaceStore, FavoritePlace } from '../src/stores/favoritePlaceStore';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';
import { useDistanceFormatter } from '../src/utils/distanceFormatter';

export default function FavoriteManage() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { favorites, toggleActive, deleteFavorite } = useFavoritePlaceStore();
    const { formatRadius } = useDistanceFormatter();

    const handleToggle = useCallback(async (id: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await toggleActive(id);
    }, [toggleActive]);

    const handleEdit = useCallback((fav: FavoritePlace) => {
        router.push({
            pathname: '/favorite-place-setup',
            params: {
                editId: fav.id,
                latitude: String(fav.latitude),
                longitude: String(fav.longitude),
                radius: String(fav.radius),
            },
        });
    }, []);

    const handleDelete = useCallback((fav: FavoritePlace) => {
        Alert.alert(
            t('home.deleteFavorite.title'),
            t('home.deleteFavorite.message', { name: fav.label }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('home.deleteFavorite.confirm'),
                    style: 'destructive',
                    onPress: async () => {
                        await deleteFavorite(fav.id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    },
                },
            ]
        );
    }, [t, deleteFavorite]);

    // 스케줄 요약 텍스트 생성
    const getScheduleSummary = useCallback((fav: FavoritePlace): string => {
        if (!fav.schedule?.enabled) return t('favoriteManage.noSchedule');

        const dayNames = [
            t('days.sun'), t('days.mon'), t('days.tue'), t('days.wed'),
            t('days.thu'), t('days.fri'), t('days.sat'),
        ];

        const days = fav.schedule.days.length === 0
            ? t('favoriteManage.everyday')
            : fav.schedule.days.length === 5 &&
              [1,2,3,4,5].every(d => fav.schedule!.days.includes(d))
                ? t('favoriteManage.weekdays')
                : fav.schedule.days.map(d => dayNames[d]).join(', ');

        return `${days} ${fav.schedule.startTime}~${fav.schedule.endTime}`;
    }, [t]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('favoriteManage.title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            >
                {favorites.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="star-outline" size={64} color={colors.textWeak} />
                        <Text style={styles.emptyText}>{t('favoriteManage.empty')}</Text>
                    </View>
                ) : (
                    favorites.map((fav) => (
                        <View key={fav.id} style={styles.favoriteCard}>
                            <View style={styles.favoriteLeft}>
                                <View style={[
                                    styles.iconCircle,
                                    !fav.isActive && styles.iconCircleInactive,
                                ]}>
                                    <Ionicons
                                        name={fav.icon as any}
                                        size={20}
                                        color={fav.isActive ? colors.primary : colors.textWeak}
                                    />
                                </View>
                                <View style={styles.favoriteInfo}>
                                    <Text style={[
                                        styles.favoriteLabel,
                                        !fav.isActive && styles.favoriteLabelInactive,
                                    ]}>
                                        {fav.label}
                                    </Text>
                                    <Text style={styles.favoriteSchedule}>
                                        {getScheduleSummary(fav)}
                                    </Text>
                                    <Text style={styles.favoriteRadius}>
                                        {formatRadius(fav.radius)}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.favoriteRight}>
                                <Switch
                                    value={fav.isActive}
                                    onValueChange={() => handleToggle(fav.id)}
                                    trackColor={{ false: colors.textMedium, true: colors.primary }}
                                    ios_backgroundColor={colors.textMedium}
                                />
                                <View style={styles.actionButtons}>
                                    <Pressable
                                        style={styles.actionButton}
                                        onPress={() => handleEdit(fav)}
                                    >
                                        <Ionicons name="create-outline" size={20} color={colors.textMedium} />
                                    </Pressable>
                                    <Pressable
                                        style={styles.actionButton}
                                        onPress={() => handleDelete(fav)}
                                    >
                                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    ))
                )}

                {/* 추가 버튼 (10개 미만일 때) */}
                {favorites.length < 10 && (
                    <Pressable
                        style={styles.addButton}
                        onPress={() => router.push('/favorite-place-setup')}
                    >
                        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                        <Text style={styles.addButtonText}>{t('favoriteManage.addNew')}</Text>
                    </Pressable>
                )}
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.background,
    },
    headerTitle: {
        ...typography.heading,
        color: colors.textStrong,
    },
    backButton: {
        padding: spacing.xs,
        marginLeft: -spacing.xs,
    },
    content: {
        flex: 1,
        padding: spacing.md,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
        gap: spacing.sm,
    },
    emptyText: {
        ...typography.body,
        color: colors.textWeak,
        textAlign: 'center',
    },
    favoriteCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...shadows.card,
    },
    favoriteLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: spacing.sm,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: `${colors.primary}15`,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconCircleInactive: {
        backgroundColor: colors.background,
    },
    favoriteInfo: {
        flex: 1,
    },
    favoriteLabel: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
    },
    favoriteLabelInactive: {
        color: colors.textWeak,
    },
    favoriteSchedule: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 2,
    },
    favoriteRadius: {
        ...typography.caption,
        color: colors.textWeak,
        marginTop: 1,
    },
    favoriteRight: {
        alignItems: 'flex-end',
        gap: spacing.xs,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    actionButton: {
        padding: 4,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.xs,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.primary,
    },
    addButtonText: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '600',
    },
});

/**
 * Favorite Place Setup Screen
 * Add or edit a favorite location for quick access
 */

import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useFavoritePlaceStore } from '../src/stores/favoritePlaceStore';
import { colors, typography, spacing, radius, shadows } from '../src/styles/theme';
import { useDistanceFormatter } from '../src/utils/distanceFormatter';

// Available icons for selection
const ICONS = [
    'home', 'business', 'cafe', 'school', 'fitness', 'cart',
    'airplane', 'restaurant', 'walk', 'people', 'heart', 'star',
    'location', 'flag', 'bookmark', 'pin',
];

export default function FavoritePlaceSetup() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        latitude: string;
        longitude: string;
        address?: string;
        radius?: string;
    }>();

    const [label, setLabel] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('home');
    const savedRadius = params.radius ? parseInt(params.radius) : 500;

    const { t } = useTranslation();
    const { addFavorite, favorites } = useFavoritePlaceStore();
    const { formatRadius } = useDistanceFormatter();

    const handleSave = async () => {
        if (!label.trim()) {
            Alert.alert(t('favoriteSetup.noName'), t('favoriteSetup.pleaseEnterName'));
            return;
        }

        if (!params.latitude || !params.longitude) {
            Alert.alert(t('common.error'), t('alarmSetup.locationError'));
            return;
        }

        if (favorites.length >= 3) {
            Alert.alert(t('common.error'), t('favoriteSetup.maxLimitReached'));
            return;
        }

        const lat = parseFloat(params.latitude);
        const lng = parseFloat(params.longitude);

        if (isNaN(lat) || isNaN(lng)) {
            Alert.alert(t('common.error'), t('alarmSetup.locationError'));
            return;
        }

        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            await addFavorite({
                label: label.trim(),
                icon: selectedIcon,
                latitude: lat,
                longitude: lng,
                radius: savedRadius,
            });

            router.back();
        } catch (error) {
            console.error('[FavoritePlaceSetup] Failed to save:', error);
            Alert.alert(t('common.error'), t('common.saveFailed'));
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    style={styles.closeButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="close" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('favoriteSetup.title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Name Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('favoriteSetup.nameLabel')}</Text>
                    <TextInput
                        style={styles.input}
                        value={label}
                        onChangeText={setLabel}
                        placeholder={t('favoriteSetup.namePlaceholder')}
                        placeholderTextColor={colors.textWeak}
                        autoFocus
                    />
                </View>

                {/* Icon Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('favoriteSetup.iconLabel')}</Text>
                    <View style={styles.iconGrid}>
                        {ICONS.map((icon) => (
                            <Pressable
                                key={icon}
                                style={[
                                    styles.iconOption,
                                    selectedIcon === icon && styles.iconOptionSelected,
                                ]}
                                onPress={() => {
                                    setSelectedIcon(icon);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                            >
                                <Ionicons
                                    name={icon as any}
                                    size={24}
                                    color={selectedIcon === icon ? colors.primary : colors.textMedium}
                                />
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Details Display (Read-only) */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('favoriteSetup.locationLabel')}</Text>
                    <View style={styles.detailsCard}>
                        <View style={styles.detailRow}>
                            <Ionicons name="location-outline" size={20} color={colors.primary} />
                            <Text style={styles.detailText} numberOfLines={1}>
                                {params.address || `${params.latitude}, ${params.longitude}`}
                            </Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Ionicons name="radio-button-on-outline" size={20} color={colors.primary} />
                            <Text style={styles.detailText}>{t('home.radius', { radius: formatRadius(savedRadius) })}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Save Button */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
                <Pressable
                    style={({ pressed }) => [
                        styles.saveButton,
                        pressed && styles.saveButtonPressed,
                        !label.trim() && styles.saveButtonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={!label.trim()}
                >
                    <Text style={styles.saveButtonText}>{t('favoriteSetup.save')}</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
    content: {
        flex: 1,
        padding: spacing.md,
    },
    section: {
        marginBottom: spacing.md,
    },
    label: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    iconOption: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '22%',
        paddingVertical: spacing.xs,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    iconOptionSelected: {
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}10`,
    },
    iconLabel: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 4,
    },
    iconLabelSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        ...typography.body,
        color: colors.textStrong,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
    },
    infoText: {
        ...typography.body,
        color: colors.textMedium,
        flex: 1,
    },
    footer: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.background,
    },
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        ...shadows.button,
    },
    saveButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    saveButtonDisabled: {
        backgroundColor: colors.textWeak,
        opacity: 0.5,
    },
    saveButtonText: {
        ...typography.body,
        color: colors.surface,
        fontWeight: '600',
    },
    closeButton: {
        padding: spacing.xs,
        marginLeft: -spacing.xs,
    },
    detailsCard: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.background,
        gap: spacing.sm,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    detailText: {
        ...typography.body,
        color: colors.textMedium,
        flex: 1,
    },
});

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
import { useFavoritePlaceStore } from '../src/stores/favoritePlaceStore';
import { colors, typography, spacing, radius, shadows } from '../src/styles/theme';

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
    }>();

    const [label, setLabel] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('home');
    const [customRadius] = useState(500);

    const { addFavorite, favorites } = useFavoritePlaceStore();

    const handleSave = async () => {
        if (!label.trim()) {
            Alert.alert('이름 필요', '즐겨찾기 이름을 입력해주세요.');
            return;
        }

        if (!params.latitude || !params.longitude) {
            Alert.alert('오류', '위치 정보가 없습니다.');
            return;
        }

        if (favorites.length >= 3) {
            Alert.alert('최대 등록', '즐겨찾기는 최대 3개까지 등록할 수 있습니다.');
            return;
        }

        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            await addFavorite({
                label: label.trim(),
                icon: selectedIcon,
                latitude: parseFloat(params.latitude),
                longitude: parseFloat(params.longitude),
                radius: customRadius,
            });

            router.back();
        } catch (error) {
            console.error('[FavoritePlaceSetup] Failed to save:', error);
            Alert.alert('오류', '저장에 실패했습니다.');
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Ionicons name="close" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>즐겨찾기 추가</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Name Input - First */}
                <View style={styles.section}>
                    <Text style={styles.label}>이름</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="예: 집, 회사, 카페"
                        placeholderTextColor={colors.textWeak}
                        value={label}
                        onChangeText={setLabel}
                    />
                </View>

                {/* Icon Selection - Second */}
                <View style={styles.section}>
                    <Text style={styles.label}>아이콘</Text>
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

                {/* Location Info */}
                <View style={styles.section}>
                    <Text style={styles.label}>위치</Text>
                    <View style={styles.infoCard}>
                        <Ionicons name="location" size={18} color={colors.primary} />
                        <Text style={styles.infoText} numberOfLines={1}>
                            {params.address || `${params.latitude}, ${params.longitude}`}
                        </Text>
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
                    <Text style={styles.saveButtonText}>저장하기</Text>
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
        fontWeight: '700',
    },
});

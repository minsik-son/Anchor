/**
 * LocaAlert Background Picker
 * Full-screen gallery page for selecting alarm backgrounds
 */

import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useAlarmSettingsStore, BACKGROUND_THEMES, ThemeCategoryKey } from '../src/stores/alarmSettingsStore';
import { useThemeColors, ThemeColors, typography, spacing, radius } from '../src/styles/theme';

type TabType = 'default' | ThemeCategoryKey | 'gallery';

export default function BackgroundPickerScreen() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { backgroundType, selectedPreset, setBackgroundType, setSelectedPreset } = useAlarmSettingsStore();

    // Determine active tab based on current selection
    const getInitialTab = (): TabType => {
        if (backgroundType === 'default') return 'default';
        if (backgroundType === 'custom') return 'gallery';
        // Find which theme the selectedPreset belongs to
        for (const theme of BACKGROUND_THEMES) {
            if (theme.images.some(img => img.key === selectedPreset)) {
                return theme.key;
            }
        }
        return 'default';
    };

    const [activeTab, setActiveTab] = useState<TabType>(getInitialTab());

    const handleImageSelect = useCallback(async (imageKey: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setBackgroundType('preset');
        setSelectedPreset(imageKey);
        router.back();
    }, [setBackgroundType, setSelectedPreset]);

    const handleDefaultSelect = useCallback(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setBackgroundType('default');
        router.back();
    }, [setBackgroundType]);

    const handleGalleryPick = useCallback(async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [9, 16],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setBackgroundType('custom');
            useAlarmSettingsStore.getState().setCustomImageUri(result.assets[0].uri);
            router.back();
        }
    }, [setBackgroundType]);

    const getCurrentTheme = () => {
        return BACKGROUND_THEMES.find(theme => theme.key === activeTab);
    };

    const renderImages = () => {
        const theme = getCurrentTheme();
        if (!theme) return null;

        return (
            <FlatList
                data={theme.images}
                numColumns={2}
                keyExtractor={(item) => item.key}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={styles.gridContent}
                renderItem={({ item }) => {
                    const isSelected = backgroundType === 'preset' && selectedPreset === item.key;
                    return (
                        <Pressable
                            style={[styles.imageCard]}
                            onPress={() => handleImageSelect(item.key)}
                        >
                            <Image
                                source={item.asset}
                                style={styles.imageCardImage}
                                resizeMode="cover"
                            />
                            {isSelected && (
                                <View style={styles.selectedOverlay}>
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={40}
                                        color="#FFFFFF"
                                    />
                                </View>
                            )}
                        </Pressable>
                    );
                }}
                scrollEnabled={true}
            />
        );
    };

    const renderDefaultContent = () => {
        const isSelected = backgroundType === 'default';
        return (
            <View style={styles.defaultContainer}>
                <Pressable
                    style={[styles.defaultCard, isSelected && styles.defaultCardSelected]}
                    onPress={handleDefaultSelect}
                >
                    <View style={styles.defaultCardGradient}>
                        <Text style={styles.defaultCardText}>{t('settings.backgroundPicker.default')}</Text>
                    </View>
                    {isSelected && (
                        <View style={styles.selectedOverlay}>
                            <Ionicons
                                name="checkmark-circle"
                                size={40}
                                color="#FFFFFF"
                            />
                        </View>
                    )}
                </Pressable>
            </View>
        );
    };

    const renderGalleryContent = () => {
        return (
            <View style={styles.galleryContainer}>
                <Pressable
                    style={styles.galleryButton}
                    onPress={handleGalleryPick}
                >
                    <Ionicons name="images" size={48} color={colors.primary} />
                    <Text style={styles.galleryButtonText}>{t('settings.backgroundPicker.gallery')}</Text>
                </Pressable>
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('settings.backgroundPicker.title')}</Text>
                <View style={{ width: 28 }} />
            </View>

            {/* Theme Tabs */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsContainer}
                contentContainerStyle={styles.tabsContent}
            >
                <Pressable
                    style={[
                        styles.tab,
                        activeTab === 'default' && styles.tabActive,
                    ]}
                    onPress={() => setActiveTab('default')}
                >
                    <Ionicons
                        name="home"
                        size={18}
                        color={activeTab === 'default' ? '#FFFFFF' : colors.textStrong}
                    />
                    <Text style={[
                        styles.tabText,
                        activeTab === 'default' && styles.tabTextActive,
                    ]}>
                        {t('settings.backgroundPicker.default')}
                    </Text>
                </Pressable>

                {BACKGROUND_THEMES.map((theme) => (
                    <Pressable
                        key={theme.key}
                        style={[
                            styles.tab,
                            activeTab === theme.key && styles.tabActive,
                        ]}
                        onPress={() => setActiveTab(theme.key)}
                    >
                        <Text style={[
                            styles.tabText,
                            activeTab === theme.key && styles.tabTextActive,
                        ]}>
                            {t(theme.labelKey)}
                        </Text>
                    </Pressable>
                ))}

                <Pressable
                    style={[
                        styles.tab,
                        activeTab === 'gallery' && styles.tabActive,
                    ]}
                    onPress={() => setActiveTab('gallery')}
                >
                    <Ionicons
                        name="image"
                        size={18}
                        color={activeTab === 'gallery' ? '#FFFFFF' : colors.textStrong}
                    />
                    <Text style={[
                        styles.tabText,
                        activeTab === 'gallery' && styles.tabTextActive,
                    ]}>
                        {t('settings.backgroundPicker.gallery')}
                    </Text>
                </Pressable>
            </ScrollView>

            {/* Content */}
            <View style={styles.content}>
                {activeTab === 'default' && renderDefaultContent()}
                {activeTab === 'gallery' && renderGalleryContent()}
                {activeTab !== 'default' && activeTab !== 'gallery' && renderImages()}
            </View>
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
        paddingVertical: spacing.md,
    },
    headerTitle: {
        ...typography.heading,
        color: colors.textStrong,
    },
    tabsContainer: {
        borderBottomWidth: 1,
        borderBottomColor: colors.surface,
        flexGrow: 0,
    },
    tabsContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.surface,
        marginRight: 8,
    },
    tabActive: {
        backgroundColor: colors.primary,
    },
    tabText: {
        ...typography.body,
        color: colors.textStrong,
        fontSize: 14,
    },
    tabTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    gridRow: {
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    gridContent: {
        paddingVertical: spacing.md,
    },
    imageCard: {
        flex: 1,
        aspectRatio: 9 / 16,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: colors.surface,
    },
    imageCardImage: {
        flex: 1,
        width: '100%',
    },
    defaultContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    defaultCard: {
        width: '100%',
        aspectRatio: 9 / 16,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: colors.error,
    },
    defaultCardSelected: {
        opacity: 0.9,
    },
    defaultCardGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FF4444',
    },
    defaultCardText: {
        ...typography.heading,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    galleryContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    galleryButton: {
        width: '100%',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.primary,
        borderStyle: 'dashed',
    },
    galleryButtonText: {
        ...typography.body,
        color: colors.primary,
        marginTop: spacing.md,
        fontWeight: '600',
    },
    selectedOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(49, 130, 246, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

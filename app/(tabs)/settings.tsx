/**
 * LocaAlert Settings Screen
 * App settings and preferences
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius, shadows } from '../../src/styles/theme';

export default function Settings() {
    const insets = useSafeAreaInsets();
    const { t, i18n } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState(false);

    const currentLanguage = i18n.language;

    const handleLanguageChange = (lang: string) => {
        setShowLanguageModal(false);
        setIsLoading(true);

        // Toss-style delay for smooth transition
        setTimeout(() => {
            i18n.changeLanguage(lang);
            // Slight delay after language change before hiding loader
            setTimeout(() => {
                setIsLoading(false);
            }, 500);
        }, 1000);
    };

    const getLanguageLabel = (lang: string) => {
        switch (lang) {
            case 'ko': return '한국어';
            case 'en': return 'English';
            case 'ja': return '日本語';
            default: return '한국어';
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView
                style={[styles.container, { paddingTop: insets.top }]}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('settings.title')}</Text>
                </View>

                {/* App Info */}
                <View style={styles.section}>
                    <View style={styles.appInfo}>
                        <View style={styles.appIconContainer}>
                            <Text style={styles.appIcon}>📍</Text>
                        </View>
                        <View>
                            <Text style={styles.appName}>LocaAlert</Text>
                            <Text style={styles.appVersion}>{t('settings.items.version')} 1.0.0</Text>
                        </View>
                    </View>
                </View>

                {/* App Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.sections.app')}</Text>

                    <SettingItem
                        icon="language"
                        label={t('settings.items.language')}
                        description={getLanguageLabel(currentLanguage)}
                        onPress={() => setShowLanguageModal(true)}
                        rightElement={
                            <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                        }
                    />
                </View>

                {/* Location Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.items.backgroundLocation') || '위치 설정'}</Text>

                    <SettingItem
                        icon="navigate"
                        label={t('settings.items.backgroundLocation') || '백그라운드 위치 추적'}
                        rightElement={<Switch value={true} trackColor={{ false: colors.textWeak, true: colors.primary }} />}
                    />

                    <SettingItem
                        icon="battery-charging"
                        label={t('settings.items.batterySaving') || '배터리 세이빙 모드'}
                        rightElement={<Switch value={true} trackColor={{ false: colors.textWeak, true: colors.primary }} />}
                    />
                </View>

                {/* Alarm Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.sections.notification')}</Text>

                    <SettingItem
                        icon="volume-high"
                        label={t('settings.items.smartVolume') || '스마트 볼륨'}
                        rightElement={<Switch value={true} trackColor={{ false: colors.textWeak, true: colors.primary }} />}
                    />

                    <SettingItem
                        icon="vibrate"
                        label={t('settings.items.vibration')}
                        rightElement={<Switch value={true} trackColor={{ false: colors.textWeak, true: colors.primary }} />}
                    />

                    <SettingItem
                        icon="phone-portrait"
                        label={t('settings.items.shakeToOff') || '흔들어서 끄기'}
                        rightElement={<Switch value={false} trackColor={{ false: colors.textWeak, true: colors.primary }} />}
                    />
                </View>

                {/* Map Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.sections.map') || '지도 설정'}</Text>

                    <SettingItem
                        icon="map"
                        label={t('settings.items.mapEngine') || '지도 엔진'}
                        description="Google Maps"
                        rightElement={
                            <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                        }
                    />
                </View>

                {/* About */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.items.help')}</Text>

                    <SettingItem
                        icon="help-circle"
                        label={t('settings.items.help')}
                        rightElement={
                            <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                        }
                    />

                    <SettingItem
                        icon="document-text"
                        label={t('settings.items.privacy')}
                        rightElement={
                            <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                        }
                    />

                    <SettingItem
                        icon="shield-checkmark"
                        label={t('settings.items.licenses')}
                        rightElement={
                            <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                        }
                    />
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Made with ❤️ for better commuting
                    </Text>
                </View>
            </ScrollView>

            {/* Language Selection Modal */}
            {showLanguageModal && (
                <Pressable style={styles.modalOverlay} onPress={() => setShowLanguageModal(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{t('settings.items.language')}</Text>

                        {[
                            { code: 'ko', label: '한국어 🇰🇷' },
                            { code: 'en', label: 'English 🇺🇸' },
                            { code: 'ja', label: '日本語 🇯🇵' }
                        ].map((lang) => (
                            <Pressable
                                key={lang.code}
                                style={[
                                    styles.languageOption,
                                    currentLanguage === lang.code && styles.languageOptionSelected
                                ]}
                                onPress={() => handleLanguageChange(lang.code)}
                            >
                                <Text style={[
                                    styles.languageOptionText,
                                    currentLanguage === lang.code && styles.languageOptionTextSelected
                                ]}>
                                    {lang.label}
                                </Text>
                                {currentLanguage === lang.code && (
                                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                                )}
                            </Pressable>
                        ))}
                    </View>
                </Pressable>
            )}

            {/* Loading Overlay */}
            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>{t('common.loading')}</Text>
                </View>
            )}
        </View>
    );
}

function SettingItem({
    icon,
    label,
    description,
    rightElement,
    onPress,
}: {
    icon: string;
    label: string;
    description?: string;
    rightElement?: React.ReactNode;
    onPress?: () => void;
}) {
    return (
        <Pressable style={styles.settingItem} onPress={onPress}>
            <View style={styles.settingLeft}>
                <Ionicons name={icon as any} size={24} color={colors.primary} />
                <View style={styles.settingContent}>
                    <Text style={styles.settingLabel}>{label}</Text>
                    {description && (
                        <Text style={styles.settingDescription}>{description}</Text>
                    )}
                </View>
            </View>
            {rightElement}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    headerTitle: {
        ...typography.display,
        color: colors.textStrong,
    },
    section: {
        marginTop: spacing.md,
        backgroundColor: colors.surface,
        paddingVertical: spacing.xs,
    },
    sectionTitle: {
        ...typography.caption,
        color: colors.textWeak,
        fontWeight: '700',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    appInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
    },
    appIconContainer: {
        width: 64,
        height: 64,
        borderRadius: radius.md,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    appIcon: {
        fontSize: 32,
    },
    appName: {
        ...typography.heading,
        color: colors.textStrong,
    },
    appVersion: {
        ...typography.caption,
        color: colors.textWeak,
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    settingContent: {
        flex: 1,
    },
    settingLabel: {
        ...typography.body,
        color: colors.textStrong,
    },
    settingDescription: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 2,
    },
    footer: {
        paddingVertical: spacing.lg,
        alignItems: 'center',
    },
    footerText: {
        ...typography.caption,
        color: colors.textWeak,
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        width: '80%',
        ...shadows.card,
    },
    modalTitle: {
        ...typography.heading,
        color: colors.textStrong,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    languageOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.background,
    },
    languageOptionSelected: {
        backgroundColor: colors.background,
    },
    languageOptionText: {
        ...typography.body,
        color: colors.textMedium,
    },
    languageOptionTextSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
    },
    loadingText: {
        ...typography.body,
        color: colors.textMedium,
        marginTop: spacing.md,
        fontWeight: '500',
    },
});

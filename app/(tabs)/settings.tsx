/**
 * LocaAlert Settings Screen
 * App settings and preferences
 */

import { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ScrollView, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../../src/styles/theme';
import { useThemeStore, ThemeMode } from '../../src/stores/themeStore';
import {
    useAlarmSettingsStore,
    AlertType,
    AlarmSoundKey,
    ALARM_SOUNDS,
    ALARM_BACKGROUNDS,
    BackgroundType,
    PresetKey,
} from '../../src/stores/alarmSettingsStore';
import { useAlarmSound } from '../../src/hooks/useAlarmSound';

const ALERT_TYPE_OPTIONS: { code: AlertType; labelKey: string; icon: string }[] = [
    { code: 'both', labelKey: 'settings.alertType.both', icon: 'notifications' },
    { code: 'sound', labelKey: 'settings.alertType.soundOnly', icon: 'volume-high' },
    { code: 'vibration', labelKey: 'settings.alertType.vibrationOnly', icon: 'vibrate' },
];

const SOUND_KEYS: AlarmSoundKey[] = ['breeze', 'alert', 'digital', 'crystal'];
const PRESET_KEYS: PresetKey[] = ['sunset', 'ocean', 'aurora', 'night'];

export default function Settings() {
    const insets = useSafeAreaInsets();
    const { t, i18n } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { mode, setMode } = useThemeStore();
    const {
        alertType, selectedSound, setAlertType, setSelectedSound,
        shakeToDismiss, setShakeToDismiss,
        backgroundType, selectedPreset, customImageUri,
        setBackgroundType, setSelectedPreset, setCustomImageUri,
    } = useAlarmSettingsStore();
    const { play: previewSound, stop: stopPreview } = useAlarmSound();

    const [isLoading, setIsLoading] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState(false);
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [showAlertTypeModal, setShowAlertTypeModal] = useState(false);
    const [showSoundPickerModal, setShowSoundPickerModal] = useState(false);
    const [showBackgroundModal, setShowBackgroundModal] = useState(false);

    const currentLanguage = i18n.language;
    const hasSoundSetting = alertType === 'both' || alertType === 'sound';

    const isSameLanguage = (lang: string) => lang === i18n.language;

    const handleLanguageChange = (lang: string) => {
        // 1. Validation: Prevent redundant re-selection
        if (isSameLanguage(lang)) {
            setShowLanguageModal(false);
            return;
        }

        // 2. Transition and Update logic
        setShowLanguageModal(false);
        setIsLoading(true);

        setTimeout(() => {
            i18n.changeLanguage(lang);
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

    const getThemeLabel = (m: ThemeMode) => {
        switch (m) {
            case 'light': return t('settings.theme.light');
            case 'dark': return t('settings.theme.dark');
            case 'system': return t('settings.theme.system');
            default: return t('settings.theme.system');
        }
    };

    const getAlertTypeLabel = (type: AlertType) => {
        const option = ALERT_TYPE_OPTIONS.find(o => o.code === type);
        return option ? t(option.labelKey) : '';
    };

    const handleThemeChange = (newMode: ThemeMode) => {
        setMode(newMode);
        setShowThemeModal(false);
    };

    const handleAlertTypeChange = (type: AlertType) => {
        setAlertType(type);
        setShowAlertTypeModal(false);
    };

    const handleSoundSelect = useCallback((soundKey: AlarmSoundKey) => {
        setSelectedSound(soundKey);
        previewSound(soundKey);
    }, [setSelectedSound, previewSound]);

    const handleCloseSoundPicker = useCallback(() => {
        stopPreview();
        setShowSoundPickerModal(false);
    }, [stopPreview]);

    const handleBackgroundSelect = useCallback((type: BackgroundType, preset?: PresetKey) => {
        setBackgroundType(type);
        if (preset) setSelectedPreset(preset);
        if (type !== 'custom') setShowBackgroundModal(false);
    }, [setBackgroundType, setSelectedPreset]);

    const handleGalleryPick = useCallback(async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [9, 16],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setCustomImageUri(result.assets[0].uri);
            setBackgroundType('custom');
            setShowBackgroundModal(false);
        }
    }, [setCustomImageUri, setBackgroundType]);

    const getBackgroundLabel = () => {
        if (backgroundType === 'preset') return t(ALARM_BACKGROUNDS[selectedPreset].labelKey);
        if (backgroundType === 'custom') return t('settings.backgroundPicker.gallery');
        return t('settings.backgroundPicker.default');
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
                        colors={colors}
                    />

                    <SettingItem
                        icon="color-palette"
                        label={t('settings.items.theme')}
                        description={getThemeLabel(mode)}
                        onPress={() => setShowThemeModal(true)}
                        rightElement={
                            <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                        }
                        colors={colors}
                    />
                </View>

                {/* Location Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.items.backgroundLocation') || '위치 설정'}</Text>

                    <SettingItem
                        icon="navigate"
                        label={t('settings.items.backgroundLocation') || '백그라운드 위치 추적'}
                        rightElement={<Switch value={true} trackColor={{ false: colors.textWeak, true: colors.primary }} />}
                        colors={colors}
                    />

                    <SettingItem
                        icon="battery-charging"
                        label={t('settings.items.batterySaving') || '배터리 세이빙 모드'}
                        rightElement={<Switch value={true} trackColor={{ false: colors.textWeak, true: colors.primary }} />}
                        colors={colors}
                    />
                </View>

                {/* Alarm Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.sections.notification')}</Text>

                    <SettingItem
                        icon="notifications"
                        label={t('settings.items.alertType')}
                        description={getAlertTypeLabel(alertType)}
                        onPress={() => setShowAlertTypeModal(true)}
                        rightElement={
                            <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                        }
                        colors={colors}
                    />

                    {hasSoundSetting && (
                        <SettingItem
                            icon="musical-notes"
                            label={t('settings.items.sound')}
                            description={t(ALARM_SOUNDS[selectedSound].labelKey)}
                            onPress={() => setShowSoundPickerModal(true)}
                            rightElement={
                                <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                            }
                            colors={colors}
                        />
                    )}

                    <SettingItem
                        icon="phone-portrait"
                        label={t('settings.items.shakeToOff')}
                        rightElement={
                            <Switch
                                value={shakeToDismiss}
                                onValueChange={setShakeToDismiss}
                                trackColor={{ false: colors.textWeak, true: colors.primary }}
                            />
                        }
                        colors={colors}
                    />

                    <SettingItem
                        icon="image"
                        label={t('settings.items.alarmBackground')}
                        description={getBackgroundLabel()}
                        onPress={() => setShowBackgroundModal(true)}
                        rightElement={
                            <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                        }
                        colors={colors}
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
                        colors={colors}
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
                        colors={colors}
                    />

                    <SettingItem
                        icon="document-text"
                        label={t('settings.items.privacy')}
                        rightElement={
                            <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                        }
                        colors={colors}
                    />

                    <SettingItem
                        icon="shield-checkmark"
                        label={t('settings.items.licenses')}
                        rightElement={
                            <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                        }
                        colors={colors}
                    />
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Made with ❤️ for better commuting
                    </Text>
                </View>
            </ScrollView>

            {/* Theme Selection Modal */}
            {showThemeModal && (
                <Pressable style={styles.modalOverlay} onPress={() => setShowThemeModal(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{t('settings.theme.title')}</Text>

                        {[
                            { code: 'light', label: t('settings.theme.light'), icon: 'sunny' },
                            { code: 'dark', label: t('settings.theme.dark'), icon: 'moon' },
                            { code: 'system', label: t('settings.theme.system'), icon: 'settings-sharp' }
                        ].map((item) => (
                            <Pressable
                                key={item.code}
                                style={[
                                    styles.optionRow,
                                    mode === item.code && styles.optionRowSelected
                                ]}
                                onPress={() => handleThemeChange(item.code as ThemeMode)}
                            >
                                <View style={styles.optionLeft}>
                                    <Ionicons name={item.icon as any} size={20} color={mode === item.code ? colors.primary : colors.textMedium} />
                                    <Text style={[
                                        styles.optionText,
                                        mode === item.code && styles.optionTextSelected
                                    ]}>
                                        {item.label}
                                    </Text>
                                </View>
                                {mode === item.code && (
                                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                                )}
                            </Pressable>
                        ))}
                    </View>
                </Pressable>
            )}

            {/* Language Selection Modal */}
            {showLanguageModal && (
                <Pressable style={styles.modalOverlay} onPress={() => setShowLanguageModal(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{t('settings.items.language')}</Text>

                        {[
                            { code: 'ko', label: '한국어' },
                            { code: 'en', label: 'English' },
                            { code: 'ja', label: '日本語' }
                        ].map((lang) => (
                            <Pressable
                                key={lang.code}
                                style={[
                                    styles.optionRow,
                                    currentLanguage === lang.code && styles.optionRowSelected
                                ]}
                                onPress={() => handleLanguageChange(lang.code)}
                            >
                                <Text style={[
                                    styles.optionText,
                                    currentLanguage === lang.code && styles.optionTextSelected
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

            {/* Alert Type Modal */}
            {showAlertTypeModal && (
                <Pressable style={styles.modalOverlay} onPress={() => setShowAlertTypeModal(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{t('settings.alertType.title')}</Text>

                        {ALERT_TYPE_OPTIONS.map((option) => (
                            <Pressable
                                key={option.code}
                                style={[
                                    styles.optionRow,
                                    alertType === option.code && styles.optionRowSelected
                                ]}
                                onPress={() => handleAlertTypeChange(option.code)}
                            >
                                <View style={styles.optionLeft}>
                                    <Ionicons
                                        name={option.icon as any}
                                        size={20}
                                        color={alertType === option.code ? colors.primary : colors.textMedium}
                                    />
                                    <Text style={[
                                        styles.optionText,
                                        alertType === option.code && styles.optionTextSelected
                                    ]}>
                                        {t(option.labelKey)}
                                    </Text>
                                </View>
                                {alertType === option.code && (
                                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                                )}
                            </Pressable>
                        ))}
                    </View>
                </Pressable>
            )}

            {/* Sound Picker Modal */}
            {showSoundPickerModal && (
                <Pressable style={styles.modalOverlay} onPress={handleCloseSoundPicker}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{t('settings.soundPicker.title')}</Text>

                        {SOUND_KEYS.map((soundKey) => (
                            <Pressable
                                key={soundKey}
                                style={[
                                    styles.optionRow,
                                    selectedSound === soundKey && styles.optionRowSelected
                                ]}
                                onPress={() => handleSoundSelect(soundKey)}
                            >
                                <View style={styles.optionLeft}>
                                    <Ionicons
                                        name="play-circle"
                                        size={20}
                                        color={selectedSound === soundKey ? colors.primary : colors.textMedium}
                                    />
                                    <Text style={[
                                        styles.optionText,
                                        selectedSound === soundKey && styles.optionTextSelected
                                    ]}>
                                        {t(ALARM_SOUNDS[soundKey].labelKey)}
                                    </Text>
                                </View>
                                {selectedSound === soundKey && (
                                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                                )}
                            </Pressable>
                        ))}
                    </View>
                </Pressable>
            )}

            {/* Background Picker Modal */}
            {showBackgroundModal && (
                <Pressable style={styles.modalOverlay} onPress={() => setShowBackgroundModal(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{t('settings.backgroundPicker.title')}</Text>

                        {/* Default option */}
                        <Pressable
                            style={[
                                styles.optionRow,
                                backgroundType === 'default' && styles.optionRowSelected,
                            ]}
                            onPress={() => handleBackgroundSelect('default')}
                        >
                            <View style={styles.optionLeft}>
                                <View style={[styles.presetPreview, { backgroundColor: colors.error }]} />
                                <Text style={[
                                    styles.optionText,
                                    backgroundType === 'default' && styles.optionTextSelected,
                                ]}>
                                    {t('settings.backgroundPicker.default')}
                                </Text>
                            </View>
                            {backgroundType === 'default' && (
                                <Ionicons name="checkmark" size={20} color={colors.primary} />
                            )}
                        </Pressable>

                        {/* Preset options */}
                        {PRESET_KEYS.map((key) => {
                            const isSelected = backgroundType === 'preset' && selectedPreset === key;
                            return (
                                <Pressable
                                    key={key}
                                    style={[
                                        styles.optionRow,
                                        isSelected && styles.optionRowSelected,
                                    ]}
                                    onPress={() => handleBackgroundSelect('preset', key)}
                                >
                                    <View style={styles.optionLeft}>
                                        <Image
                                            source={ALARM_BACKGROUNDS[key].asset}
                                            style={styles.presetPreview}
                                        />
                                        <Text style={[
                                            styles.optionText,
                                            isSelected && styles.optionTextSelected,
                                        ]}>
                                            {t(ALARM_BACKGROUNDS[key].labelKey)}
                                        </Text>
                                    </View>
                                    {isSelected && (
                                        <Ionicons name="checkmark" size={20} color={colors.primary} />
                                    )}
                                </Pressable>
                            );
                        })}

                        {/* Gallery option */}
                        <Pressable
                            style={[
                                styles.optionRow,
                                backgroundType === 'custom' && styles.optionRowSelected,
                            ]}
                            onPress={handleGalleryPick}
                        >
                            <View style={styles.optionLeft}>
                                <Ionicons name="images" size={20} color={backgroundType === 'custom' ? colors.primary : colors.textMedium} />
                                <Text style={[
                                    styles.optionText,
                                    backgroundType === 'custom' && styles.optionTextSelected,
                                ]}>
                                    {t('settings.backgroundPicker.gallery')}
                                </Text>
                            </View>
                            {backgroundType === 'custom' && (
                                <Ionicons name="checkmark" size={20} color={colors.primary} />
                            )}
                        </Pressable>
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
    colors
}: {
    icon: string;
    label: string;
    description?: string;
    rightElement?: React.ReactNode;
    onPress?: () => void;
    colors: ThemeColors;
}) {
    const styles = useMemo(() => createStyles(colors), [colors]);

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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.background,
    },
    optionRowSelected: {
        backgroundColor: colors.background,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    presetPreview: {
        width: 40,
        height: 40,
        borderRadius: radius.sm,
    },
    optionText: {
        ...typography.body,
        color: colors.textMedium,
    },
    optionTextSelected: {
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

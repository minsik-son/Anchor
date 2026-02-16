import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AlertType = 'both' | 'sound' | 'vibration';
export type AlarmSoundKey = 'breeze' | 'alert' | 'digital' | 'crystal';
export type BackgroundType = 'default' | 'preset' | 'custom';
export type ThemeCategoryKey = 'pixel_dream' | 'aura' | 'into_the_wild' | 'city_lights' | 'still_moment';

interface AlarmSettingsState {
    alertType: AlertType;
    selectedSound: AlarmSoundKey;
    shakeToDismiss: boolean;
    backgroundType: BackgroundType;
    selectedPreset: string;
    customImageUri: string | null;
    setAlertType: (type: AlertType) => void;
    setSelectedSound: (sound: AlarmSoundKey) => void;
    setShakeToDismiss: (enabled: boolean) => void;
    setBackgroundType: (type: BackgroundType) => void;
    setSelectedPreset: (preset: string) => void;
    setCustomImageUri: (uri: string | null) => void;
}

export const ALARM_SOUNDS: Record<AlarmSoundKey, { labelKey: string; asset: number }> = {
    breeze: {
        labelKey: 'settings.sounds.breeze',
        asset: require('../../assets/sounds/breeze.wav'),
    },
    alert: {
        labelKey: 'settings.sounds.alert',
        asset: require('../../assets/sounds/alert.wav'),
    },
    digital: {
        labelKey: 'settings.sounds.digital',
        asset: require('../../assets/sounds/digital.wav'),
    },
    crystal: {
        labelKey: 'settings.sounds.crystal',
        asset: require('../../assets/sounds/crystal.wav'),
    },
};

export interface BackgroundImage {
    key: string;
    asset: number;
    label: string;
}

export interface BackgroundTheme {
    key: ThemeCategoryKey;
    labelKey: string;
    images: BackgroundImage[];
}

export const BACKGROUND_THEMES: BackgroundTheme[] = [
    {
        key: 'pixel_dream',
        labelKey: 'settings.backgroundThemes.pixelDream',
        images: [
            { key: 'pixel_dream_01', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_01.jpg'), label: 'Riverside Sunset' },
            { key: 'pixel_dream_02', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_02.jpg'), label: 'Cherry Blossom Lane' },
            { key: 'pixel_dream_03', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_03.jpg'), label: 'Milky Way Forest' },
            { key: 'pixel_dream_04', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_04.jpg'), label: 'Golden Power Lines' },
            { key: 'pixel_dream_05', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_05.jpg'), label: 'Rooftop Stargazer' },
            { key: 'pixel_dream_06', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_06.jpg'), label: 'Rainy Attic' },
            { key: 'pixel_dream_07', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_07.jpg'), label: 'Urban Sunset' },
            { key: 'pixel_dream_08', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_08.jpg'), label: 'Lighthouse Dusk' },
            { key: 'pixel_dream_09', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_09.jpg'), label: 'Sunset Classroom' },
            { key: 'pixel_dream_10', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_10.jpg'), label: 'Autumn Station' },
            { key: 'pixel_dream_11', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_11.jpg'), label: 'Summer Beach' },
            { key: 'pixel_dream_12', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_12.jpg'), label: 'School Yard' },
            { key: 'pixel_dream_13', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_13.jpg'), label: 'Sunlit Room' },
            { key: 'pixel_dream_14', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_14.jpg'), label: 'Night Train' },
            { key: 'pixel_dream_15', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_15.jpg'), label: 'Greenhouse' },
            { key: 'pixel_dream_16', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_16.jpg'), label: 'Rainy Night Room' },
            { key: 'pixel_dream_17', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_17.jpg'), label: 'Rainy Café' },
            { key: 'pixel_dream_18', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_18.jpg'), label: 'Mountain Nightfall' },
        ],
    },
    {
        key: 'aura',
        labelKey: 'settings.backgroundThemes.aura',
        images: [
            { key: 'aura_01', asset: require('../../assets/images/backgrounds/aura/aura_01.jpg'), label: 'Rose Quartz' },
            { key: 'aura_02', asset: require('../../assets/images/backgrounds/aura/aura_02.jpg'), label: 'Peach Glow' },
            { key: 'aura_03', asset: require('../../assets/images/backgrounds/aura/aura_03.jpg'), label: 'Mint Haze' },
            { key: 'aura_04', asset: require('../../assets/images/backgrounds/aura/aura_04.jpg'), label: 'Cotton Candy' },
            { key: 'aura_05', asset: require('../../assets/images/backgrounds/aura/aura_05.jpg'), label: 'Deep Ocean' },
            { key: 'aura_06', asset: require('../../assets/images/backgrounds/aura/aura_06.jpg'), label: 'Twilight Blush' },
            { key: 'aura_07', asset: require('../../assets/images/backgrounds/aura/aura_07.jpg'), label: 'Lavender Mist' },
            { key: 'aura_08', asset: require('../../assets/images/backgrounds/aura/aura_08.jpg'), label: 'Clear Sky' },
            { key: 'aura_09', asset: require('../../assets/images/backgrounds/aura/aura_09.jpg'), label: 'Neon Violet' },
            { key: 'aura_10', asset: require('../../assets/images/backgrounds/aura/aura_10.jpg'), label: 'Morning Fog' },
        ],
    },
    {
        key: 'into_the_wild',
        labelKey: 'settings.backgroundThemes.intoTheWild',
        images: [
            { key: 'wild_01', asset: require('../../assets/images/backgrounds/into_the_wild/wild_01.jpg'), label: 'Northern Lights' },
            { key: 'wild_02', asset: require('../../assets/images/backgrounds/into_the_wild/wild_02.jpg'), label: 'Deep Blue' },
            { key: 'wild_03', asset: require('../../assets/images/backgrounds/into_the_wild/wild_03.jpg'), label: 'Golden Wheat' },
            { key: 'wild_04', asset: require('../../assets/images/backgrounds/into_the_wild/wild_04.jpg'), label: 'Frost Needles' },
            { key: 'wild_05', asset: require('../../assets/images/backgrounds/into_the_wild/wild_05.jpg'), label: 'Morning Dew' },
            { key: 'wild_06', asset: require('../../assets/images/backgrounds/into_the_wild/wild_06.jpg'), label: 'Starry Night' },
            { key: 'wild_07', asset: require('../../assets/images/backgrounds/into_the_wild/wild_07.jpg'), label: 'Spring Petal' },
            { key: 'wild_08', asset: require('../../assets/images/backgrounds/into_the_wild/wild_08.jpg'), label: 'Forest Moss' },
            { key: 'wild_09', asset: require('../../assets/images/backgrounds/into_the_wild/wild_09.jpg'), label: 'Dark Woods' },
            { key: 'wild_10', asset: require('../../assets/images/backgrounds/into_the_wild/wild_10.jpg'), label: 'Moonlit Clouds' },
        ],
    },
    {
        key: 'city_lights',
        labelKey: 'settings.backgroundThemes.cityLights',
        images: [
            { key: 'city_01', asset: require('../../assets/images/backgrounds/city_lights/city_01.jpg'), label: 'Rainy Window' },
            { key: 'city_02', asset: require('../../assets/images/backgrounds/city_lights/city_02.jpg'), label: 'City Bokeh' },
        ],
    },
    {
        key: 'still_moment',
        labelKey: 'settings.backgroundThemes.stillMoment',
        images: [
            { key: 'still_01', asset: require('../../assets/images/backgrounds/still_moment/still_01.jpg'), label: 'Floral Shadow' },
            { key: 'still_02', asset: require('../../assets/images/backgrounds/still_moment/still_02.jpg'), label: 'White Feather' },
            { key: 'still_03', asset: require('../../assets/images/backgrounds/still_moment/still_03.jpg'), label: 'Glass Garden' },
            { key: 'still_04', asset: require('../../assets/images/backgrounds/still_moment/still_04.jpg'), label: 'Sunset Silhouette' },
        ],
    },
];

export function getBackgroundAsset(presetKey: string): number | null {
    for (const theme of BACKGROUND_THEMES) {
        const found = theme.images.find(img => img.key === presetKey);
        if (found) return found.asset;
    }
    return null;
}

export function getBackgroundLabel(presetKey: string): string | null {
    for (const theme of BACKGROUND_THEMES) {
        const found = theme.images.find(img => img.key === presetKey);
        if (found) return found.label;
    }
    return null;
}

export const useAlarmSettingsStore = create<AlarmSettingsState>()(
    persist(
        (set) => ({
            alertType: 'both',
            selectedSound: 'breeze',
            shakeToDismiss: false,
            backgroundType: 'default',
            selectedPreset: 'pixel_dream_01',
            customImageUri: null,
            setAlertType: (alertType) => set({ alertType }),
            setSelectedSound: (selectedSound) => set({ selectedSound }),
            setShakeToDismiss: (shakeToDismiss) => set({ shakeToDismiss }),
            setBackgroundType: (backgroundType) => set({ backgroundType }),
            setSelectedPreset: (selectedPreset) => set({ selectedPreset }),
            setCustomImageUri: (customImageUri) => set({ customImageUri }),
        }),
        {
            name: 'alarm-settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

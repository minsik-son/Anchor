import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AlertType = 'both' | 'sound' | 'vibration';
export type AlarmSoundKey = 'breeze' | 'alert' | 'digital' | 'crystal';
export type BackgroundType = 'default' | 'preset' | 'custom';
export type PresetKey = 'sunset' | 'ocean' | 'aurora' | 'night';

interface AlarmSettingsState {
    alertType: AlertType;
    selectedSound: AlarmSoundKey;
    shakeToDismiss: boolean;
    backgroundType: BackgroundType;
    selectedPreset: PresetKey;
    customImageUri: string | null;
    setAlertType: (type: AlertType) => void;
    setSelectedSound: (sound: AlarmSoundKey) => void;
    setShakeToDismiss: (enabled: boolean) => void;
    setBackgroundType: (type: BackgroundType) => void;
    setSelectedPreset: (preset: PresetKey) => void;
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

export const ALARM_BACKGROUNDS: Record<PresetKey, { labelKey: string; asset: number }> = {
    sunset: {
        labelKey: 'settings.backgrounds.sunset',
        asset: require('../../assets/images/bg-preset-1.png'),
    },
    ocean: {
        labelKey: 'settings.backgrounds.ocean',
        asset: require('../../assets/images/bg-preset-2.png'),
    },
    aurora: {
        labelKey: 'settings.backgrounds.aurora',
        asset: require('../../assets/images/bg-preset-3.png'),
    },
    night: {
        labelKey: 'settings.backgrounds.night',
        asset: require('../../assets/images/bg-preset-4.png'),
    },
};

export const useAlarmSettingsStore = create<AlarmSettingsState>()(
    persist(
        (set) => ({
            alertType: 'both',
            selectedSound: 'breeze',
            shakeToDismiss: false,
            backgroundType: 'default',
            selectedPreset: 'sunset',
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

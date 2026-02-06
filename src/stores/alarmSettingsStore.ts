import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AlertType = 'both' | 'sound' | 'vibration';
export type AlarmSoundKey = 'breeze' | 'alert' | 'digital' | 'crystal';

interface AlarmSettingsState {
    alertType: AlertType;
    selectedSound: AlarmSoundKey;
    setAlertType: (type: AlertType) => void;
    setSelectedSound: (sound: AlarmSoundKey) => void;
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

export const useAlarmSettingsStore = create<AlarmSettingsState>()(
    persist(
        (set) => ({
            alertType: 'both',
            selectedSound: 'breeze',
            setAlertType: (alertType) => set({ alertType }),
            setSelectedSound: (selectedSound) => set({ selectedSound }),
        }),
        {
            name: 'alarm-settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

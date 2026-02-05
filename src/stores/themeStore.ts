import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            mode: 'system', // Default to system
            setMode: (mode) => set({ mode }),
        }),
        {
            name: 'theme-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

// Helper to get actual theme value
export const getEffectiveScheme = (mode: ThemeMode): 'light' | 'dark' => {
    if (mode === 'system') {
        const colorScheme = Appearance.getColorScheme();
        return colorScheme === 'dark' ? 'dark' : 'light';
    }
    return mode;
};

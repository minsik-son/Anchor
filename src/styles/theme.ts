/**
 * LocaAlert Design System (Toss Style)
 * Design Philosophy: "Extreme Simplicity"
 */

import { useThemeStore } from '../stores/themeStore';
import { useColorScheme } from 'react-native';

export interface ThemePalette {
    primary: string;
    background: string;
    surface: string;
    textStrong: string;
    textMedium: string;
    textWeak: string;
    error: string;
    success: string;
    warning: string;
    border: string;
    overlay: string;
}

// Light Theme Palette
export const lightColors: ThemePalette = {
    primary: '#3182F6',      // Toss Blue
    background: '#F2F4F6',   // Light Warm Grey
    surface: '#FFFFFF',      // White
    textStrong: '#191F28',   // Strong text (Dark Grey)
    textMedium: '#4E5968',   // Medium text (Grey)
    textWeak: '#8B95A1',     // Weak text (Light Grey)
    error: '#F04452',        // Error/Alert
    success: '#00C853',      // Success
    warning: '#FF9800',      // Warning
    border: '#E5E8EB',
    overlay: 'rgba(0,0,0,0.5)',
};

// Dark Theme Palette
export const darkColors: ThemePalette = {
    primary: '#3182F6',      // Toss Blue (Same or slightly adjusted)
    background: '#101012',   // Very Dark Grey (not full black)
    surface: '#202027',      // Dark Surface
    textStrong: '#F9FAFB',   // White/Light Grey
    textMedium: '#B0B8C1',   // Light Grey
    textWeak: '#6B7684',     // Darker Grey
    error: '#F25D69',        // Lighter Red for dark mode
    success: '#26D07C',      // Lighter Green
    warning: '#FFA726',      // Lighter Orange
    border: '#333D4B',
    overlay: 'rgba(0,0,0,0.7)',
};

// Defualt colors for backward compatibility (defaults to light)
export const colors = lightColors;

// Typography (Pretendard font family) - Shared across themes for now
export const typography = {
    display: {
        fontSize: 26,
        fontWeight: '700' as const,
        lineHeight: 34,
    },
    heading: {
        fontSize: 20,
        fontWeight: '700' as const,
        lineHeight: 28,
    },
    body: {
        fontSize: 16,
        fontWeight: '500' as const,
        lineHeight: 24,
    },
    caption: {
        fontSize: 13,
        fontWeight: '400' as const,
        lineHeight: 18,
    },
} as const;

// Spacing (8px base unit)
export const spacing = {
    xs: 8,
    sm: 16,
    md: 24,
    lg: 48,
} as const;

// Border Radius
export const radius = {
    sm: 8,
    md: 16,
    lg: 24,
    full: 9999,
} as const;

// Shadows
export const shadows = {
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
    },
    button: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
} as const;

// Animation Durations
export const animation = {
    fast: 150,
    normal: 300,
    slow: 500,
} as const;

// Default Alarm Settings
export const alarmDefaults = {
    radius: 100, // meters
    minRadius: 50,
    maxRadius: 5000,
} as const;

// Hook to get current theme colors
export const useThemeColors = (): ThemePalette => {
    const mode = useThemeStore((state) => state.mode);
    const systemScheme = useColorScheme();

    const effectiveMode = mode === 'system' ? (systemScheme || 'light') : mode;

    return effectiveMode === 'dark' ? darkColors : lightColors;
};

export type ThemeColors = ThemePalette;
export type ThemeTypography = typeof typography;
export type ThemeSpacing = typeof spacing;

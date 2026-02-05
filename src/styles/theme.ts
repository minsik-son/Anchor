/**
 * LocaAlert Design System (Toss Style)
 * Design Philosophy: "Extreme Simplicity"
 */

// Color Palette
export const colors = {
    primary: '#3182F6',      // Toss Blue
    background: '#F2F4F6',   // Light Warm Grey
    surface: '#FFFFFF',      // White
    textStrong: '#191F28',   // Strong text
    textMedium: '#4E5968',   // Medium text
    textWeak: '#8B95A1',     // Weak text
    error: '#F04452',        // Error/Alert
    success: '#00C853',      // Success
    warning: '#FF9800',      // Warning
} as const;

// Typography (Pretendard font family)
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

// Smart Interval Constants (Battery Saving Algorithm)
export const smartInterval = {
    restPhase: {
        distance: 10000,  // > 10km
        interval: 600000, // 10 minutes
    },
    approachPhase: {
        distance: 2000,   // 2km - 10km
        interval: 180000, // 3 minutes
    },
    preparePhase: {
        distance: 1000,   // 1km - 2km
        interval: 60000,  // 1 minute
    },
    targetPhase: {
        distance: 1000,   // <= 1km
        distanceFilter: 10, // 10m
    },
    highSpeedThreshold: 100, // km/h (KTX etc.)
    highSpeedMultiplier: 1.5,
} as const;

// Default Alarm Settings
export const alarmDefaults = {
    radius: 500, // meters
    minRadius: 100,
    maxRadius: 5000,
} as const;

export type ThemeColors = typeof colors;
export type ThemeTypography = typeof typography;
export type ThemeSpacing = typeof spacing;

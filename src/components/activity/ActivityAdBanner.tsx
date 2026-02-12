/**
 * ActivityAdBanner
 * AdMob Medium Rectangle (300x250) with graceful fallback
 * Safely handles Expo Go environment where native ads module is unavailable
 */

import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeColors, shadows, radius, spacing, typography } from '../../styles/theme';

let BannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;

try {
    const ads = require('react-native-google-mobile-ads');
    BannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
    TestIds = ads.TestIds;
} catch {
    // Native module not available (e.g. running in Expo Go)
}

interface ActivityAdBannerProps {
    colors: ThemeColors;
}

export function ActivityAdBanner({ colors }: ActivityAdBannerProps) {
    const [adFailed, setAdFailed] = useState(false);

    if (!BannerAd || adFailed) {
        return (
            <View style={styles.container}>
                <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.placeholderLabel, { color: colors.textWeak }]}>AD</Text>
                    <Text style={[styles.placeholderSub, { color: colors.textWeak }]}>Sponsored Area</Text>
                </View>
            </View>
        );
    }

    const adUnitId = __DEV__ ? TestIds.BANNER : TestIds.BANNER;

    return (
        <View style={styles.container}>
            <BannerAd
                unitId={adUnitId}
                size={BannerAdSize.MEDIUM_RECTANGLE}
                onAdFailedToLoad={(error: any) => {
                    console.warn('[ActivityAdBanner] Ad failed to load:', error.message);
                    setAdFailed(true);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: spacing.sm,
    },
    placeholder: {
        width: 300,
        height: 250,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.card,
    },
    placeholderLabel: {
        ...typography.heading,
        letterSpacing: 2,
    },
    placeholderSub: {
        ...typography.caption,
        marginTop: 4,
    },
});

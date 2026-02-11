/**
 * ActivityAdBanner
 * AdMob Medium Rectangle (300x250) with graceful fallback
 * Safely handles Expo Go environment where native ads module is unavailable
 */

import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeColors } from '../../styles/theme';

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
                <View style={[styles.placeholder, { borderColor: colors.border, backgroundColor: colors.background }]}>
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
        marginVertical: 16,
    },
    placeholder: {
        width: 300,
        height: 250,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderLabel: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 2,
    },
    placeholderSub: {
        fontSize: 13,
        marginTop: 4,
    },
});

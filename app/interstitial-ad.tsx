/**
 * LocaAlert Interstitial Ad Screen
 * Full-screen ad with mockup fallback (ready for react-native-google-mobile-ads)
 */

import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing } from '../src/styles/theme';

// Try to import Google Mobile Ads (may fail in Expo Go)
let InterstitialAd: any = null;
let AdEventType: any = null;
let TestIds: any = null;

try {
    const ads = require('react-native-google-mobile-ads');
    InterstitialAd = ads.InterstitialAd;
    AdEventType = ads.AdEventType;
    TestIds = ads.TestIds;
} catch {
    // Native module not available (Expo Go)
}

// Ad unit ID — using test ID for both dev and release until production ID is ready
const AD_UNIT_ID = TestIds?.INTERSTITIAL ?? 'ca-app-pub-3940256099942544/1033173712';

export default function InterstitialAdScreen() {
    const [adLoaded, setAdLoaded] = useState(false);
    const [adShown, setAdShown] = useState(false);
    const [showCloseButton, setShowCloseButton] = useState(false);
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        if (!InterstitialAd) {
            // Native module not available → mockup mode
            startMockCountdown();
            return;
        }

        // Attempt to load real ad
        const interstitial = InterstitialAd.createForAdRequest(AD_UNIT_ID);

        const loadListener = interstitial.addAdEventListener(AdEventType.LOADED, () => {
            setAdLoaded(true);
            interstitial.show();
        });

        const closeListener = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
            navigateHome();
        });

        const errorListener = interstitial.addAdEventListener(AdEventType.ERROR, () => {
            // Ad load failed → fallback to mockup
            startMockCountdown();
        });

        interstitial.load();

        return () => {
            loadListener();
            closeListener();
            errorListener();
        };
    }, []);

    const startMockCountdown = () => {
        // 5-second countdown, then show close button
        let count = 5;
        const timer = setInterval(() => {
            count--;
            setCountdown(count);
            if (count <= 0) {
                clearInterval(timer);
                setShowCloseButton(true);
            }
        }, 1000);
    };

    const navigateHome = useCallback(() => {
        router.replace('/(tabs)/home');
    }, []);

    // If real ad is loaded/shown, render empty view (native ad overlays)
    if (adLoaded || adShown) {
        return <View style={styles.container} />;
    }

    // Mockup full-screen ad UI
    return <MockInterstitialAd countdown={countdown} showClose={showCloseButton} onClose={navigateHome} />;
}

function MockInterstitialAd({
    countdown,
    showClose,
    onClose,
}: {
    countdown: number;
    showClose: boolean;
    onClose: () => void;
}) {
    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Top bar: Close button or countdown */}
            <SafeAreaView style={styles.topBar}>
                {showClose ? (
                    <Pressable style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close" size={24} color="#FFFFFF" />
                    </Pressable>
                ) : (
                    <View style={styles.countdownBadge}>
                        <Text style={styles.countdownText}>{countdown}</Text>
                    </View>
                )}
            </SafeAreaView>

            {/* Center: Ad mockup placeholder */}
            <View style={styles.adContent}>
                <View style={styles.adImagePlaceholder}>
                    <Ionicons name="megaphone-outline" size={64} color="rgba(255,255,255,0.3)" />
                    <Text style={styles.adPlaceholderText}>AD</Text>
                    <Text style={styles.adPlaceholderSub}>Sponsored Content</Text>
                </View>
            </View>

            {/* Bottom: Ad info */}
            <View style={styles.adFooter}>
                <Text style={styles.adFooterText}>광고 · Sponsored</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1A1A1A',
    },
    topBar: {
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 10,
        padding: spacing.sm,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    countdownBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    countdownText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    adContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    adImagePlaceholder: {
        width: '80%',
        aspectRatio: 0.8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    adPlaceholderText: {
        fontSize: 32,
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.2)',
        letterSpacing: 4,
        marginTop: spacing.sm,
    },
    adPlaceholderSub: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.15)',
        marginTop: spacing.xs,
    },
    adFooter: {
        paddingBottom: 40,
        alignItems: 'center',
    },
    adFooterText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.4)',
    },
});

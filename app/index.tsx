/**
 * LocaAlert Entry Point
 * Routes to onboarding or main app based on permission status
 */

import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../src/styles/theme';

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

export default function Index() {
    const [isLoading, setIsLoading] = useState(true);
    const [needsOnboarding, setNeedsOnboarding] = useState(true);

    useEffect(() => {
        async function checkOnboardingStatus() {
            try {
                // Check if onboarding was completed
                const onboardingComplete = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);

                if (onboardingComplete === 'true') {
                    // Verify permissions are still granted
                    const { status } = await Location.getForegroundPermissionsAsync();
                    setNeedsOnboarding(status !== 'granted');
                } else {
                    setNeedsOnboarding(true);
                }
            } catch (error) {
                console.error('[Index] Failed to check onboarding status:', error);
                setNeedsOnboarding(true);
            } finally {
                setIsLoading(false);
            }
        }

        checkOnboardingStatus();
    }, []);

    if (isLoading) {
        return <View style={styles.container} />;
    }

    if (needsOnboarding) {
        return <Redirect href="/onboarding" />;
    }

    return <Redirect href="/(tabs)/home" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
});

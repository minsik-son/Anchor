/**
 * LocaAlert Onboarding Screen
 * Permission request with persuasive UI (Toss style)
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing, radius, shadows } from '../src/styles/theme';

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

export default function Onboarding() {
    const insets = useSafeAreaInsets();
    const [isLoading, setIsLoading] = useState(false);

    const handleStart = async () => {
        setIsLoading(true);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // Request foreground permission first
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

            if (foregroundStatus !== 'granted') {
                Alert.alert(
                    '위치 권한 필요',
                    '목적지 도착 알람을 위해 위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
                    [{ text: '확인' }]
                );
                setIsLoading(false);
                return;
            }

            // Request background permission
            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

            if (backgroundStatus !== 'granted') {
                Alert.alert(
                    '백그라운드 권한 필요',
                    '앱이 꺼진 상태에서도 알람을 받으려면 "항상 허용"을 선택해주세요.',
                    [
                        { text: '나중에', onPress: () => completeOnboarding() },
                        { text: '설정으로', onPress: () => Location.enableNetworkProviderAsync() },
                    ]
                );
                return;
            }

            await completeOnboarding();
        } catch (error: any) {
            console.error('[Onboarding] Permission request failed:', error);

            // Handle Expo Go environment where Info.plist keys may not be available
            if (error?.message?.includes('NSLocation') || error?.message?.includes('Info.plist')) {
                Alert.alert(
                    'Expo Go 제한',
                    '실제 기기에서 위치 권한을 테스트하려면 Development Build가 필요합니다. 지금은 권한 없이 계속할까요?',
                    [
                        { text: '취소', onPress: () => setIsLoading(false) },
                        { text: '계속하기', onPress: () => completeOnboarding() },
                    ]
                );
            } else {
                Alert.alert('오류', '권한 요청 중 문제가 발생했습니다.');
                setIsLoading(false);
            }
        }
    };

    const completeOnboarding = async () => {
        await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)/home');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Illustration Area */}
            <View style={styles.illustrationContainer}>
                <View style={styles.illustrationCircle}>
                    <Text style={styles.illustrationEmoji}>📍</Text>
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.title}>도착 1km 전,{'\n'}미리 깨워드릴게요</Text>
                <Text style={styles.subtitle}>
                    지하철, 버스, 기차 어디서든{'\n'}
                    목적지에 도착하기 전 알람을 받아보세요
                </Text>
            </View>

            {/* Features */}
            <View style={styles.features}>
                <FeatureItem icon="🔋" text="스마트 배터리 절약" />
                <FeatureItem icon="🎯" text="정확한 위치 기반 알람" />
                <FeatureItem icon="📝" text="할 일 체크리스트" />
            </View>

            {/* CTA Button */}
            <View style={styles.ctaContainer}>
                <Pressable
                    style={({ pressed }) => [
                        styles.ctaButton,
                        pressed && styles.ctaButtonPressed,
                    ]}
                    onPress={handleStart}
                    disabled={isLoading}
                >
                    <Text style={styles.ctaText}>
                        {isLoading ? '권한 요청 중...' : '시작하기'}
                    </Text>
                </Pressable>

                <Text style={styles.permissionNote}>
                    위치 권한 허용이 필요합니다
                </Text>
            </View>
        </View>
    );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
    return (
        <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>{icon}</Text>
            <Text style={styles.featureText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.md,
    },
    illustrationContainer: {
        flex: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    illustrationCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.card,
    },
    illustrationEmoji: {
        fontSize: 64,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        ...typography.display,
        color: colors.textStrong,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: colors.textMedium,
        textAlign: 'center',
        lineHeight: 24,
    },
    features: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        marginVertical: spacing.md,
    },
    featureItem: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        ...shadows.button,
    },
    featureIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    featureText: {
        ...typography.caption,
        color: colors.textMedium,
    },
    ctaContainer: {
        paddingVertical: spacing.lg,
    },
    ctaButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        alignItems: 'center',
        ...shadows.button,
    },
    ctaButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    ctaText: {
        ...typography.heading,
        color: colors.surface,
    },
    permissionNote: {
        ...typography.caption,
        color: colors.textWeak,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
});

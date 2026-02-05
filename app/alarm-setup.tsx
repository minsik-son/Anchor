/**
 * LocaAlert Alarm Setup Screen
 * Detailed alarm configuration with memo and radius settings
 */

import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useLocationStore } from '../src/stores/locationStore';
import { colors, typography, spacing, radius, shadows, alarmDefaults } from '../src/styles/theme';

export default function AlarmSetup() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        latitude: string;
        longitude: string;
        radius: string;
        address?: string;
        locationName?: string;
    }>();

    const [title, setTitle] = useState('');
    const [alarmRadius, setAlarmRadius] = useState(
        params.radius ? parseInt(params.radius) : alarmDefaults.radius
    );
    const [memo, setMemo] = useState('');

    const { createAlarm } = useAlarmStore();
    const { startTracking } = useLocationStore();

    const handleCreateAlarm = async () => {
        if (!title.trim()) {
            Alert.alert('알람 제목 필요', '알람 제목을 입력해주세요.');
            return;
        }

        if (!params.latitude || !params.longitude) {
            Alert.alert('오류', '위치 정보가 없습니다.');
            return;
        }

        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            const alarmId = await createAlarm({
                title: title.trim(),
                latitude: parseFloat(params.latitude),
                longitude: parseFloat(params.longitude),
                radius: alarmRadius,
            });

            // Start location tracking
            await startTracking(
                {
                    latitude: parseFloat(params.latitude),
                    longitude: parseFloat(params.longitude),
                },
                alarmRadius
            );

            Alert.alert('알람 생성 완료', '목적지 추적을 시작합니다!', [
                { text: '확인', onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error('[AlarmSetup] Failed to create alarm:', error);
            Alert.alert('오류', '알람 생성에 실패했습니다.');
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>알람 만들기</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Title Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>제목</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={[styles.input, styles.inputWithButton]}
                            placeholder="예: 강남역, 회사, 집"
                            placeholderTextColor={colors.textWeak}
                            value={title}
                            onChangeText={setTitle}
                        />
                        <Pressable
                            style={styles.autoFillButton}
                            onPress={() => {
                                const autoTitle = params.locationName || params.address || '내 위치';
                                setTitle(autoTitle);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                        >
                            <Ionicons name="sparkles" size={20} color={colors.primary} />
                        </Pressable>
                    </View>
                </View>

                {/* Radius Slider */}
                <View style={styles.section}>
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>알람 반경</Text>
                        <Text style={styles.radiusValue}>{alarmRadius}m</Text>
                    </View>

                    <Slider
                        style={styles.slider}
                        minimumValue={alarmDefaults.minRadius}
                        maximumValue={alarmDefaults.maxRadius}
                        value={alarmRadius}
                        onValueChange={(value) => {
                            setAlarmRadius(Math.round(value / 50) * 50); // Round to nearest 50
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={colors.background}
                        thumbTintColor={colors.primary}
                        step={50}
                    />

                    <View style={styles.radiusLabels}>
                        <Text style={styles.radiusLabel}>{alarmDefaults.minRadius}m</Text>
                        <Text style={styles.radiusLabel}>{alarmDefaults.maxRadius}m</Text>
                    </View>
                </View>

                {/* Memo Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>메모 (선택사항)</Text>
                    <TextInput
                        style={[styles.input, styles.memoInput]}
                        placeholder="예: 우산 챙기기, 3번 출구"
                        placeholderTextColor={colors.textWeak}
                        value={memo}
                        onChangeText={setMemo}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Features Info */}
                <View style={styles.infoCard}>
                    <Ionicons name="information-circle" size={24} color={colors.primary} />
                    <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>스마트 배터리 세이빙</Text>
                        <Text style={styles.infoText}>
                            목적지까지의 거리에 따라 자동으로 위치 체크 주기를 조절하여 배터리를 절약합니다.
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Create Button */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
                <Pressable
                    style={({ pressed }) => [
                        styles.createButton,
                        pressed && styles.createButtonPressed,
                        !title.trim() && styles.createButtonDisabled,
                    ]}
                    onPress={handleCreateAlarm}
                    disabled={!title.trim()}
                >
                    <Text style={styles.createButtonText}>알람 만들기</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.background,
    },
    headerTitle: {
        ...typography.heading,
        color: colors.textStrong,
    },
    content: {
        flex: 1,
        padding: spacing.md,
    },
    section: {
        marginBottom: spacing.md,
    },
    label: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    radiusValue: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '700',
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        ...typography.body,
        color: colors.textStrong,
    },
    inputRow: {
        flexDirection: 'row',
        gap: spacing.xs,
        alignItems: 'center',
    },
    inputWithButton: {
        flex: 1,
    },
    autoFillButton: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.button,
    },
    memoInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    radiusLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    radiusLabel: {
        ...typography.caption,
        color: colors.textWeak,
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: `${colors.primary}10`,
        borderRadius: radius.md,
        padding: spacing.sm,
        gap: spacing.xs,
    },
    infoContent: {
        flex: 1,
    },
    infoTitle: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '600',
        marginBottom: 4,
    },
    infoText: {
        ...typography.caption,
        color: colors.textMedium,
        lineHeight: 18,
    },
    footer: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.background,
    },
    createButton: {
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        ...shadows.button,
    },
    createButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    createButtonDisabled: {
        backgroundColor: colors.textWeak,
        opacity: 0.5,
    },
    createButtonText: {
        ...typography.body,
        color: colors.surface,
        fontWeight: '700',
    },
});

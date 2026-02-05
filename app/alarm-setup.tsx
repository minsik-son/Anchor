/**
 * LocaAlert Alarm Setup Screen
 * Detailed alarm configuration with navigation settings
 */

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useAlarmStore } from '../src/stores/alarmStore';
import { useLocationStore, TransportMode, RouteInfo } from '../src/stores/locationStore';
import { colors, typography, spacing, radius, shadows, alarmDefaults } from '../src/styles/theme';

// Mock route data
const MOCK_ROUTES: RouteInfo[] = [
    {
        id: '1',
        name: '추천 경로',
        duration: 25,
        distance: 8500,
        eta: '14:25',
        coordinates: [
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.5600, longitude: 126.9850 },
            { latitude: 37.5550, longitude: 126.9900 },
        ],
    },
    {
        id: '2',
        name: '최단 시간',
        duration: 22,
        distance: 9200,
        eta: '14:22',
        coordinates: [
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.5700, longitude: 126.9900 },
            { latitude: 37.5550, longitude: 126.9900 },
        ],
    },
    {
        id: '3',
        name: '최단 거리',
        duration: 28,
        distance: 7800,
        eta: '14:28',
        coordinates: [
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.5580, longitude: 126.9820 },
            { latitude: 37.5550, longitude: 126.9900 },
        ],
    },
];

const TRANSPORT_MODES: { mode: TransportMode; icon: string; label: string }[] = [
    { mode: 'driving', icon: 'car', label: '운전' },
    { mode: 'transit', icon: 'bus', label: '대중교통' },
    { mode: 'walking', icon: 'walk', label: '도보' },
    { mode: 'cycling', icon: 'bicycle', label: '자전거' },
];

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
    const [startLocationType, setStartLocationType] = useState<'current' | 'custom'>('current');
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>('1');

    const { createAlarm } = useAlarmStore();
    const {
        startTracking,
        transportMode,
        setTransportMode,
        setRoutes,
        selectRoute,
        startNavigation
    } = useLocationStore();

    // Calculate alarm preview text
    const alarmPreview = useMemo(() => {
        const selectedRoute = MOCK_ROUTES.find(r => r.id === selectedRouteId);
        if (!selectedRoute) return null;

        // Calculate time to reach alarm radius
        const avgSpeed = transportMode === 'driving' ? 40 :
            transportMode === 'transit' ? 30 :
                transportMode === 'walking' ? 5 : 15; // km/h
        const distanceToAlarm = selectedRoute.distance - alarmRadius;
        const minutesToAlarm = Math.round((distanceToAlarm / 1000) / avgSpeed * 60);

        return {
            text: `목적지 반경 ${alarmRadius}m 전`,
            time: `약 ${minutesToAlarm}분 뒤에 알람이 울립니다`,
        };
    }, [selectedRouteId, alarmRadius, transportMode]);

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

            await createAlarm({
                title: title.trim(),
                latitude: parseFloat(params.latitude),
                longitude: parseFloat(params.longitude),
                radius: alarmRadius,
            });

            // Set routes and selected route
            setRoutes(MOCK_ROUTES);
            if (selectedRouteId) {
                selectRoute(selectedRouteId);
            }

            // Start location tracking
            await startTracking(
                {
                    latitude: parseFloat(params.latitude),
                    longitude: parseFloat(params.longitude),
                },
                alarmRadius
            );

            // Start navigation mode
            startNavigation();

            router.back();
        } catch (error) {
            console.error('[AlarmSetup] Failed to create alarm:', error);
            Alert.alert('오류', '알람 생성에 실패했습니다.');
        }
    };

    const formatDistance = (meters: number) => {
        if (meters >= 1000) {
            return `${(meters / 1000).toFixed(1)}km`;
        }
        return `${meters}m`;
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

                {/* Start Location */}
                <View style={styles.section}>
                    <Text style={styles.label}>출발지</Text>
                    <View style={styles.startLocationRow}>
                        <Pressable
                            style={[
                                styles.startLocationOption,
                                startLocationType === 'current' && styles.startLocationOptionActive,
                            ]}
                            onPress={() => {
                                setStartLocationType('current');
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                        >
                            <Ionicons
                                name="navigate"
                                size={18}
                                color={startLocationType === 'current' ? colors.primary : colors.textMedium}
                            />
                            <Text style={[
                                styles.startLocationText,
                                startLocationType === 'current' && styles.startLocationTextActive,
                            ]}>현재 위치</Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.startLocationOption,
                                startLocationType === 'custom' && styles.startLocationOptionActive,
                            ]}
                            onPress={() => {
                                setStartLocationType('custom');
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                        >
                            <Ionicons
                                name="map"
                                size={18}
                                color={startLocationType === 'custom' ? colors.primary : colors.textMedium}
                            />
                            <Text style={[
                                styles.startLocationText,
                                startLocationType === 'custom' && styles.startLocationTextActive,
                            ]}>지도에서 선택</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Transport Mode */}
                <View style={styles.section}>
                    <Text style={styles.label}>이동 수단</Text>
                    <View style={styles.transportModeRow}>
                        {TRANSPORT_MODES.map(({ mode, icon, label }) => (
                            <Pressable
                                key={mode}
                                style={[
                                    styles.transportModeButton,
                                    transportMode === mode && styles.transportModeButtonActive,
                                ]}
                                onPress={() => {
                                    setTransportMode(mode);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                            >
                                <Ionicons
                                    name={icon as any}
                                    size={22}
                                    color={transportMode === mode ? colors.surface : colors.textMedium}
                                />
                                <Text style={[
                                    styles.transportModeLabel,
                                    transportMode === mode && styles.transportModeLabelActive,
                                ]}>{label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Route Options */}
                <View style={styles.section}>
                    <Text style={styles.label}>경로 옵션</Text>
                    <View style={styles.routeCards}>
                        {MOCK_ROUTES.map((route) => (
                            <Pressable
                                key={route.id}
                                style={[
                                    styles.routeCard,
                                    selectedRouteId === route.id && styles.routeCardSelected,
                                ]}
                                onPress={() => {
                                    setSelectedRouteId(route.id);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                            >
                                <View style={styles.routeCardHeader}>
                                    <View style={[
                                        styles.routeRadio,
                                        selectedRouteId === route.id && styles.routeRadioSelected,
                                    ]}>
                                        {selectedRouteId === route.id && (
                                            <View style={styles.routeRadioInner} />
                                        )}
                                    </View>
                                    <Text style={[
                                        styles.routeName,
                                        selectedRouteId === route.id && styles.routeNameSelected,
                                    ]}>{route.name}</Text>
                                </View>
                                <View style={styles.routeInfo}>
                                    <View style={styles.routeInfoItem}>
                                        <Ionicons name="time-outline" size={14} color={colors.textWeak} />
                                        <Text style={styles.routeInfoText}>{route.duration}분</Text>
                                    </View>
                                    <View style={styles.routeInfoItem}>
                                        <Ionicons name="navigate-outline" size={14} color={colors.textWeak} />
                                        <Text style={styles.routeInfoText}>{formatDistance(route.distance)}</Text>
                                    </View>
                                    <View style={styles.routeInfoItem}>
                                        <Ionicons name="flag-outline" size={14} color={colors.textWeak} />
                                        <Text style={styles.routeInfoText}>도착 {route.eta}</Text>
                                    </View>
                                </View>
                            </Pressable>
                        ))}
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
                            setAlarmRadius(Math.round(value / 50) * 50);
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

                {/* Alarm Preview */}
                {alarmPreview && (
                    <View style={styles.alarmPreviewCard}>
                        <Ionicons name="notifications" size={24} color={colors.primary} />
                        <View style={styles.alarmPreviewContent}>
                            <Text style={styles.alarmPreviewTitle}>{alarmPreview.text}</Text>
                            <Text style={styles.alarmPreviewTime}>{alarmPreview.time}</Text>
                        </View>
                    </View>
                )}

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
                    <Text style={styles.createButtonText}>알람 시작</Text>
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
    // Start Location Styles
    startLocationRow: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    startLocationOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    startLocationOptionActive: {
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}10`,
    },
    startLocationText: {
        ...typography.body,
        color: colors.textMedium,
    },
    startLocationTextActive: {
        color: colors.primary,
        fontWeight: '600',
    },
    // Transport Mode Styles
    transportModeRow: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    transportModeButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
    },
    transportModeButtonActive: {
        backgroundColor: colors.primary,
    },
    transportModeLabel: {
        ...typography.caption,
        color: colors.textMedium,
    },
    transportModeLabelActive: {
        color: colors.surface,
        fontWeight: '600',
    },
    // Route Card Styles
    routeCards: {
        gap: spacing.xs,
    },
    routeCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    routeCardSelected: {
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}08`,
    },
    routeCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: 8,
    },
    routeRadio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.textWeak,
        alignItems: 'center',
        justifyContent: 'center',
    },
    routeRadioSelected: {
        borderColor: colors.primary,
    },
    routeRadioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    routeName: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '500',
    },
    routeNameSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    routeInfo: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginLeft: 28,
    },
    routeInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    routeInfoText: {
        ...typography.caption,
        color: colors.textWeak,
    },
    // Alarm Preview Styles
    alarmPreviewCard: {
        flexDirection: 'row',
        backgroundColor: `${colors.primary}15`,
        borderRadius: radius.md,
        padding: spacing.sm,
        gap: spacing.xs,
        marginBottom: spacing.md,
    },
    alarmPreviewContent: {
        flex: 1,
    },
    alarmPreviewTitle: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '600',
    },
    alarmPreviewTime: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 2,
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

/**
 * LocaAlert History Screen
 * Recent alarms history with swipe-to-delete and detail view
 */

import { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    Modal,
    Animated,
    PanResponder,
    Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAlarmStore } from '../../src/stores/alarmStore';
import { colors, typography, spacing, radius, shadows } from '../../src/styles/theme';
import { Alarm } from '../../src/db/schema';
import { reverseGeocode } from '../../src/services/geocoding';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DELETE_THRESHOLD = 80;
const DELETE_CONFIRM_THRESHOLD = 160;

// Format relative time (당일이면 "X분 전", 24시간 이상이면 날짜)
function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // 24시간 이내
    if (diffDays < 1) {
        if (diffMinutes < 1) return '방금 전';
        if (diffMinutes < 60) return `${diffMinutes}분 전`;
        return `${diffHours}시간 전`;
    }

    // 24시간 이상이면 날짜 표시
    return date.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
    });
}

export default function History() {
    const insets = useSafeAreaInsets();
    const { t, i18n } = useTranslation();
    const { alarms, loadAlarms, deleteAlarm, activeAlarm } = useAlarmStore();
    const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [locationAddress, setLocationAddress] = useState('');
    const [isLoadingAddress, setIsLoadingAddress] = useState(false);

    useEffect(() => {
        loadAlarms();
    }, []);

    // Fetch address when alarm is selected
    useEffect(() => {
        if (selectedAlarm && showDetail) {
            setIsLoadingAddress(true);
            setLocationAddress('');

            reverseGeocode(selectedAlarm.latitude, selectedAlarm.longitude).then((result) => {
                setLocationAddress(result.address || '주소를 찾을 수 없습니다');
                setIsLoadingAddress(false);
            });
        }
    }, [selectedAlarm, showDetail]);

    const handleAlarmPress = (alarm: Alarm) => {
        setSelectedAlarm(alarm);
        setShowDetail(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleDeleteAlarm = (alarm: Alarm) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        deleteAlarm(alarm.id);
    };

    const renderAlarmItem = ({ item }: { item: Alarm }) => (
        <SwipeableAlarmCard
            alarm={item}
            isActive={activeAlarm?.id === item.id}
            onPress={() => handleAlarmPress(item)}
            onDelete={() => handleDeleteAlarm(item)}
        />
    );

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(i18n.language, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('history.title')}</Text>
                <Text style={styles.headerSubtitle}>{t('history.total', { count: alarms.length })}</Text>
            </View>

            {alarms.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="file-tray-outline" size={64} color={colors.textWeak} />
                    <Text style={styles.emptyText}>{t('history.empty')}</Text>
                    <Text style={styles.emptySubtext}>{t('history.emptyHint')}</Text>
                </View>
            ) : (
                <FlatList
                    data={alarms}
                    renderItem={renderAlarmItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.list}
                />
            )}

            {/* Detail Modal */}
            <Modal
                visible={showDetail}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowDetail(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.md }]}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHandle} />
                            <Text style={styles.modalTitle}>알람 상세정보</Text>
                            <Pressable
                                style={styles.modalCloseButton}
                                onPress={() => setShowDetail(false)}
                            >
                                <Ionicons name="close" size={24} color={colors.textMedium} />
                            </Pressable>
                        </View>

                        {selectedAlarm && (
                            <View style={styles.detailContainer}>
                                {/* Title Section */}
                                <View style={styles.detailSection}>
                                    <View style={styles.detailRow}>
                                        <Ionicons
                                            name={selectedAlarm.is_active ? 'navigate-circle' : 'navigate-circle-outline'}
                                            size={32}
                                            color={selectedAlarm.is_active ? colors.primary : colors.textWeak}
                                        />
                                        <View style={styles.detailTitleWrapper}>
                                            <Text style={styles.detailTitle}>{selectedAlarm.title}</Text>
                                            {selectedAlarm.is_active && (
                                                <View style={styles.activeBadgeLarge}>
                                                    <Text style={styles.activeBadgeTextLarge}>활성화됨</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>

                                {/* Location Section */}
                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>위치 정보</Text>
                                    <View style={styles.detailCard}>
                                        {/* Address */}
                                        {isLoadingAddress ? (
                                            <View style={styles.detailCardRow}>
                                                <Ionicons name="location" size={20} color={colors.primary} />
                                                <Text style={[styles.detailCardText, { color: colors.textWeak }]}>
                                                    주소를 불러오는 중...
                                                </Text>
                                            </View>
                                        ) : locationAddress ? (
                                            <View style={[styles.detailCardRow, { marginBottom: spacing.xs }]}>
                                                <Ionicons name="location" size={20} color={colors.primary} />
                                                <Text style={[styles.detailCardText, { fontWeight: '600', flex: 1 }]}>
                                                    {locationAddress}
                                                </Text>
                                            </View>
                                        ) : null}

                                        {/* Coordinates */}
                                        <View style={styles.detailCardRow}>
                                            <Ionicons name="location-outline" size={20} color={colors.textWeak} />
                                            <Text style={[styles.detailCardText, { color: colors.textMedium, fontSize: 12 }]}>
                                                {selectedAlarm.latitude.toFixed(6)}, {selectedAlarm.longitude.toFixed(6)}
                                            </Text>
                                        </View>

                                        <View style={styles.detailCardRow}>
                                            <Ionicons name="radio-button-on-outline" size={20} color={colors.primary} />
                                            <Text style={styles.detailCardText}>{t('history.detail.radius', { radius: selectedAlarm.radius })}</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Date Section */}
                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>{t('history.detail.createdAt')}</Text>
                                    <View style={styles.detailCard}>
                                        <View style={styles.detailCardRow}>
                                            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                                            <Text style={styles.detailCardText}>
                                                {formatDate(selectedAlarm.created_at)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Delete Button */}
                                <Pressable
                                    style={styles.deleteButton}
                                    onPress={() => {
                                        handleDeleteAlarm(selectedAlarm);
                                        setShowDetail(false);
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={20} color={colors.surface} />
                                    <Text style={styles.deleteButtonText}>{t('history.detail.deleteAlarm')}</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// Swipeable Alarm Card Component
function SwipeableAlarmCard({
    alarm,
    isActive,
    onPress,
    onDelete
}: {
    alarm: Alarm;
    isActive: boolean;
    onPress: () => void;
    onDelete: () => void;
}) {
    const translateX = useRef(new Animated.Value(0)).current;
    const [isDeleteVisible, setIsDeleteVisible] = useState(false);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only respond to horizontal swipes
                return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
            },
            onPanResponderGrant: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
            onPanResponderMove: (_, gestureState) => {
                // Only allow left swipe (negative dx)
                if (gestureState.dx < 0) {
                    translateX.setValue(Math.max(gestureState.dx, -DELETE_CONFIRM_THRESHOLD));
                } else if (isDeleteVisible) {
                    // Allow swipe back to close
                    translateX.setValue(Math.min(gestureState.dx - DELETE_THRESHOLD, 0));
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx < -DELETE_CONFIRM_THRESHOLD) {
                    // Auto-delete if swiped past confirm threshold
                    Animated.timing(translateX, {
                        toValue: -SCREEN_WIDTH,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => onDelete());
                } else if (gestureState.dx < -DELETE_THRESHOLD || (isDeleteVisible && gestureState.dx < 0)) {
                    // Show delete button - NO ANIMATION, just snap to position
                    translateX.setValue(-DELETE_THRESHOLD);
                    setIsDeleteVisible(true);
                } else {
                    // Reset position - NO ANIMATION, just snap back
                    translateX.setValue(0);
                    setIsDeleteVisible(false);
                }
            },
        })
    ).current;

    const handleDeletePress = () => {
        Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
        }).start(() => onDelete());
    };

    return (
        <View style={styles.swipeContainer}>
            {/* Delete Button Background */}
            <View
                style={[
                    styles.deleteBackground,
                ]}
            >
                <Pressable style={styles.deleteBackgroundButton} onPress={handleDeletePress}>
                    <Ionicons name="trash" size={24} color={colors.surface} />
                    <Text style={styles.deleteBackgroundText}>삭제</Text>
                </Pressable>
            </View>

            {/* Alarm Card */}
            <Animated.View
                style={[
                    styles.alarmCard,
                    { transform: [{ translateX }] }
                ]}
                {...panResponder.panHandlers}
            >
                <Pressable onPress={onPress} style={styles.alarmCardInner}>
                    <View style={styles.alarmHeader}>
                        <View style={styles.alarmTitleContainer}>
                            <Ionicons
                                name={isActive ? 'navigate-circle' : 'navigate-circle-outline'}
                                size={24}
                                color={isActive ? colors.primary : colors.textWeak}
                            />
                            <Text style={styles.alarmTitle}>{alarm.title}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                    </View>

                    <View style={styles.alarmDetails}>
                        <Text style={styles.alarmDetail}>
                            반경 {alarm.radius}m
                        </Text>
                        <Text style={styles.alarmDetail}>•</Text>
                        <Text style={styles.alarmDetail}>
                            {formatRelativeTime(alarm.created_at)}
                        </Text>
                    </View>

                    {isActive && (
                        <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>활성화</Text>
                        </View>
                    )}
                </Pressable>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    headerTitle: {
        ...typography.display,
        color: colors.textStrong,
    },
    headerSubtitle: {
        ...typography.caption,
        color: colors.textWeak,
        marginTop: 4,
    },
    list: {
        padding: spacing.sm,
        gap: spacing.sm,
    },
    swipeContainer: {
        marginBottom: spacing.sm,
    },
    deleteBackground: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: DELETE_THRESHOLD,
        backgroundColor: colors.error,
        borderRadius: radius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteBackgroundButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
    },
    deleteBackgroundText: {
        ...typography.caption,
        color: colors.surface,
        marginTop: 4,
        fontWeight: '600',
    },
    alarmCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        ...shadows.button,
    },
    alarmCardInner: {
        padding: spacing.sm,
    },
    alarmHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    alarmTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        flex: 1,
    },
    alarmTitle: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
    },
    alarmDetails: {
        flexDirection: 'row',
        gap: spacing.xs,
        marginLeft: 32,
    },
    alarmDetail: {
        ...typography.caption,
        color: colors.textMedium,
    },
    activeBadge: {
        position: 'absolute',
        top: spacing.xs,
        right: spacing.md + 20,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xs,
        paddingVertical: 4,
        borderRadius: radius.sm,
    },
    activeBadgeText: {
        ...typography.caption,
        color: colors.surface,
        fontSize: 11,
        fontWeight: '700',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    emptyText: {
        ...typography.heading,
        color: colors.textMedium,
        marginTop: spacing.sm,
    },
    emptySubtext: {
        ...typography.body,
        color: colors.textWeak,
        marginTop: spacing.xs,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        maxHeight: '80%',
    },
    modalHeader: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.background,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: colors.textWeak,
        borderRadius: 2,
        marginBottom: spacing.xs,
    },
    modalTitle: {
        ...typography.heading,
        color: colors.textStrong,
    },
    modalCloseButton: {
        position: 'absolute',
        right: spacing.sm,
        top: spacing.sm,
        padding: spacing.xs,
    },
    detailContainer: {
        padding: spacing.md,
    },
    detailSection: {
        marginBottom: spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    detailTitleWrapper: {
        flex: 1,
    },
    detailTitle: {
        ...typography.heading,
        color: colors.textStrong,
        fontSize: 20,
    },
    detailLabel: {
        ...typography.caption,
        color: colors.textWeak,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    detailCard: {
        backgroundColor: colors.background,
        borderRadius: radius.md,
        padding: spacing.sm,
        gap: spacing.xs,
    },
    detailCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    detailCardText: {
        ...typography.body,
        color: colors.textStrong,
    },
    activeBadgeLarge: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.sm,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    activeBadgeTextLarge: {
        ...typography.caption,
        color: colors.surface,
        fontWeight: '700',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.error,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
        marginTop: spacing.md,
    },
    deleteButtonText: {
        ...typography.body,
        color: colors.surface,
        fontWeight: '600',
    },
});

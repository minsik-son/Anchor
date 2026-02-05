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
import { useAlarmStore } from '../../src/stores/alarmStore';
import { colors, typography, spacing, radius, shadows } from '../../src/styles/theme';
import { Alarm } from '../../src/db/schema';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DELETE_THRESHOLD = 80;
const DELETE_CONFIRM_THRESHOLD = 160;

export default function History() {
    const insets = useSafeAreaInsets();
    const { alarms, loadAlarms, deleteAlarm } = useAlarmStore();
    const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
    const [showDetail, setShowDetail] = useState(false);

    useEffect(() => {
        loadAlarms();
    }, []);

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
            onPress={() => handleAlarmPress(item)}
            onDelete={() => handleDeleteAlarm(item)}
        />
    );

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
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
                <Text style={styles.headerTitle}>알람 히스토리</Text>
                <Text style={styles.headerSubtitle}>총 {alarms.length}개</Text>
            </View>

            {alarms.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="file-tray-outline" size={64} color={colors.textWeak} />
                    <Text style={styles.emptyText}>아직 생성된 알람이 없습니다</Text>
                    <Text style={styles.emptySubtext}>홈 화면에서 알람을 만들어보세요!</Text>
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
                                        <View style={styles.detailCardRow}>
                                            <Ionicons name="location-outline" size={20} color={colors.primary} />
                                            <Text style={styles.detailCardText}>
                                                {selectedAlarm.latitude.toFixed(6)}, {selectedAlarm.longitude.toFixed(6)}
                                            </Text>
                                        </View>
                                        <View style={styles.detailCardRow}>
                                            <Ionicons name="radio-button-on-outline" size={20} color={colors.primary} />
                                            <Text style={styles.detailCardText}>반경 {selectedAlarm.radius}m</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Date Section */}
                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>생성 시간</Text>
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
                                    <Text style={styles.deleteButtonText}>알람 삭제</Text>
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
    onPress,
    onDelete
}: {
    alarm: Alarm;
    onPress: () => void;
    onDelete: () => void;
}) {
    const translateX = useRef(new Animated.Value(0)).current;
    const [isDeleteRevealed, setIsDeleteRevealed] = useState(false);

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
                } else if (isDeleteRevealed) {
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
                } else if (gestureState.dx < -DELETE_THRESHOLD || (isDeleteRevealed && gestureState.dx < 0)) {
                    // Show delete button
                    Animated.spring(translateX, {
                        toValue: -DELETE_THRESHOLD,
                        useNativeDriver: true,
                        friction: 8,
                    }).start();
                    setIsDeleteRevealed(true);
                } else {
                    // Reset position
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        friction: 8,
                    }).start();
                    setIsDeleteRevealed(false);
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
            <View style={styles.deleteBackground}>
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
                                name={alarm.is_active ? 'navigate-circle' : 'navigate-circle-outline'}
                                size={24}
                                color={alarm.is_active ? colors.primary : colors.textWeak}
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
                            {new Date(alarm.created_at).toLocaleDateString('ko-KR')}
                        </Text>
                    </View>

                    {alarm.is_active && (
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

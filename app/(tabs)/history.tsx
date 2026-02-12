/**
 * LocaAlert History Screen
 * Recent alarms history with swipe-to-delete, bulk delete, and detail navigation
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, PanResponder, Dimensions, Alert } from 'react-native';
import ReAnimated, { useAnimatedStyle, useSharedValue, withTiming, withSpring, Easing } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAlarmStore } from '../../src/stores/alarmStore';
import { Alarm } from '../../src/db/schema';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../../src/styles/theme';
import { useDistanceFormatter } from '../../src/utils/distanceFormatter';
import { calculateDistance } from '../../src/services/location/geofence';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DELETE_THRESHOLD = 80;
const DELETE_CONFIRM_THRESHOLD = 160;

type AlarmStatus = 'in_progress' | 'completed' | 'cancelled';

function getAlarmStatus(alarm: Alarm): AlarmStatus {
    if (alarm.is_active) return 'in_progress';
    if (alarm.arrived_at) return 'completed';
    return 'cancelled';
}

function StatusBadge({ status, colors }: { status: AlarmStatus; colors: ThemeColors }) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const config = {
        in_progress: { labelKey: 'history.status.inProgress', color: colors.success },
        completed: { labelKey: 'history.status.completed', color: colors.primary },
        cancelled: { labelKey: 'history.status.cancelled', color: colors.error },
    } as const;
    const { labelKey, color } = config[status];

    return (
        <View style={[styles.statusBadge, { backgroundColor: color }]}>
            <Text style={styles.statusBadgeText}>{t(labelKey)}</Text>
        </View>
    );
}

function formatRelativeTime(dateString: string, t: any, i18n: any): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 1) {
        if (diffMinutes < 1) return t('history.time.justNow');
        if (diffMinutes < 60) return t('history.time.minutesAgo', { minutes: diffMinutes });
        return t('history.time.hoursAgo', { hours: diffHours });
    }

    return date.toLocaleDateString(i18n.language, {
        month: 'short',
        day: 'numeric',
    });
}

function getDateKey(dateString: string): string {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatSectionDate(dateKey: string, i18n: any): string {
    const date = new Date(dateKey);
    const now = new Date();
    const today = getDateKey(now.toISOString());
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = getDateKey(yesterday.toISOString());

    if (dateKey === today) {
        return i18n.language === 'ko' ? '오늘' : i18n.language === 'ja' ? '今日' : 'Today';
    }
    if (dateKey === yesterdayKey) {
        return i18n.language === 'ko' ? '어제' : i18n.language === 'ja' ? '昨日' : 'Yesterday';
    }

    return date.toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

interface AlarmSection {
    title: string;
    dateKey: string;
    data: Alarm[];
}

function AnimatedChevron({ isCollapsed, color }: { isCollapsed: boolean; color: string }) {
    const rotation = useSharedValue(isCollapsed ? -90 : 0);

    useEffect(() => {
        rotation.value = withTiming(isCollapsed ? -90 : 0, { duration: 250 });
    }, [isCollapsed]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    return (
        <ReAnimated.View style={animatedStyle}>
            <Ionicons name="chevron-down" size={16} color={color} />
        </ReAnimated.View>
    );
}

interface CollapsibleSectionProps {
    title: string;
    dateKey: string;
    itemCount: number;
    isCollapsed: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    colors: ThemeColors;
}

function CollapsibleSection({ title, itemCount, isCollapsed, onToggle, children, colors }: CollapsibleSectionProps) {
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [contentHeight, setContentHeight] = useState(0);
    const animatedHeight = useSharedValue(0);
    const animatedOpacity = useSharedValue(1);
    const isFirstRender = useRef(true);

    const onLayout = useCallback((event: any) => {
        const height = event.nativeEvent.layout.height;
        if (height > 0 && contentHeight === 0) {
            setContentHeight(height);
            if (isFirstRender.current) {
                animatedHeight.value = height;
                isFirstRender.current = false;
            }
        }
    }, [contentHeight]);

    useEffect(() => {
        if (contentHeight > 0 && !isFirstRender.current) {
            const targetHeight = isCollapsed ? 0 : contentHeight;
            animatedHeight.value = withTiming(targetHeight, {
                duration: 300,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
            });
            animatedOpacity.value = withTiming(isCollapsed ? 0 : 1, {
                duration: 200,
            });
        }
    }, [isCollapsed, contentHeight]);

    const animatedContainerStyle = useAnimatedStyle(() => ({
        height: contentHeight === 0 ? undefined : animatedHeight.value,
        opacity: animatedOpacity.value,
        overflow: 'hidden',
    }));

    return (
        <View style={styles.sectionContainer}>
            <Pressable style={styles.sectionHeader} onPress={onToggle}>
                <View style={styles.sectionHeaderLeft}>
                    <AnimatedChevron isCollapsed={isCollapsed} color={colors.textWeak} />
                    <Text style={styles.sectionHeaderText}>{title}</Text>
                </View>
                <Text style={styles.sectionHeaderCount}>{itemCount}</Text>
            </Pressable>

            <ReAnimated.View style={animatedContainerStyle}>
                <View onLayout={contentHeight === 0 ? onLayout : undefined}>
                    {children}
                </View>
            </ReAnimated.View>
        </View>
    );
}

function groupAlarmsByDate(alarms: Alarm[], i18n: any): AlarmSection[] {
    const groups: Record<string, Alarm[]> = {};

    alarms.forEach((alarm) => {
        const dateKey = getDateKey(alarm.created_at);
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(alarm);
    });

    return Object.entries(groups)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([dateKey, data]) => ({
            title: formatSectionDate(dateKey, i18n),
            dateKey,
            data,
        }));
}

export default function History() {
    const insets = useSafeAreaInsets();
    const { t, i18n } = useTranslation();
    const { alarms, loadAlarms, deleteAlarm, deleteAllAlarms } = useAlarmStore();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    const sections = useMemo(() => groupAlarmsByDate(alarms, i18n), [alarms, i18n]);

    const toggleSection = (dateKey: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(dateKey)) {
                next.delete(dateKey);
            } else {
                next.add(dateKey);
            }
            return next;
        });
    };

    useEffect(() => {
        loadAlarms();
    }, []);

    const handleAlarmPress = (alarm: Alarm) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/alarm-detail', params: { alarmId: alarm.id.toString() } });
    };

    const handleDeleteAlarm = (alarm: Alarm) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        deleteAlarm(alarm.id);
    };

    const handleDeleteAll = () => {
        Alert.alert(
            t('history.deleteAll.title'),
            t('history.deleteAll.message'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('history.deleteAll.confirm'),
                    style: 'destructive',
                    onPress: async () => {
                        await deleteAllAlarms();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    },
                },
            ]
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>{t('history.title')}</Text>
                    <Text style={styles.headerSubtitle}>{t('history.total', { count: alarms.length })}</Text>
                </View>
                {alarms.length > 0 && (
                    <Pressable style={styles.deleteAllButton} onPress={handleDeleteAll}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                        <Text style={styles.deleteAllText}>{t('history.deleteAll.button')}</Text>
                    </Pressable>
                )}
            </View>

            <ScrollView
                contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
                showsVerticalScrollIndicator={false}
            >
                {sections.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="time-outline" size={64} color={colors.textWeak} />
                        <Text style={styles.emptyText}>{t('history.empty')}</Text>
                        <Text style={styles.emptySubtext}>{t('history.emptyHint')}</Text>
                    </View>
                ) : (
                    sections.map((section) => (
                        <CollapsibleSection
                            key={section.dateKey}
                            title={section.title}
                            dateKey={section.dateKey}
                            itemCount={section.data.length}
                            isCollapsed={collapsedSections.has(section.dateKey)}
                            onToggle={() => toggleSection(section.dateKey)}
                            colors={colors}
                        >
                            {section.data.map((alarm) => (
                                <SwipeableAlarmCard
                                    key={alarm.id}
                                    alarm={alarm}
                                    isActive={alarm.is_active}
                                    onPress={() => handleAlarmPress(alarm)}
                                    onDelete={() => handleDeleteAlarm(alarm)}
                                    colors={colors}
                                />
                            ))}
                        </CollapsibleSection>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

function SwipeableAlarmCard({
    alarm,
    isActive,
    onPress,
    onDelete,
    colors
}: {
    alarm: Alarm;
    isActive: boolean;
    onPress: () => void;
    onDelete: () => void;
    colors: ThemeColors;
}) {
    const { t, i18n } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { formatDistance } = useDistanceFormatter();
    const translateX = useRef(new Animated.Value(0)).current;

    const distance = useMemo(() => {
        if (alarm.start_latitude && alarm.start_longitude) {
            return calculateDistance(
                { latitude: alarm.start_latitude, longitude: alarm.start_longitude },
                { latitude: alarm.latitude, longitude: alarm.longitude }
            );
        }
        return null;
    }, [alarm]);
    const [isDeleteVisible, setIsDeleteVisible] = useState(false);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
            },
            onPanResponderGrant: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dx < 0) {
                    translateX.setValue(Math.max(gestureState.dx, -DELETE_CONFIRM_THRESHOLD));
                } else if (isDeleteVisible) {
                    translateX.setValue(Math.min(gestureState.dx - DELETE_THRESHOLD, 0));
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx < -DELETE_CONFIRM_THRESHOLD) {
                    Animated.timing(translateX, {
                        toValue: -SCREEN_WIDTH,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => onDelete());
                } else if (gestureState.dx < -DELETE_THRESHOLD || (isDeleteVisible && gestureState.dx < 0)) {
                    translateX.setValue(-DELETE_THRESHOLD);
                    setIsDeleteVisible(true);
                } else {
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
            <View style={styles.deleteBackground}>
                <Pressable style={styles.deleteBackgroundButton} onPress={handleDeletePress}>
                    <Ionicons name="trash" size={24} color={colors.surface} />
                    <Text style={styles.deleteBackgroundText}>{t('common.delete')}</Text>
                </Pressable>
            </View>

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
                        <View style={styles.statusContainer}>
                            <StatusBadge status={getAlarmStatus(alarm)} colors={colors} />
                            <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                        </View>
                    </View>

                    <View style={styles.alarmDetails}>
                        <Text style={styles.alarmDetail}>
                            {distance !== null ? formatDistance(distance) : '-'}
                        </Text>
                        <Text style={styles.alarmDetail}>•</Text>
                        <Text style={styles.alarmDetail}>
                            {formatRelativeTime(alarm.created_at, t, i18n)}
                        </Text>
                    </View>
                </Pressable>
            </Animated.View>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
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
    deleteAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.error,
    },
    deleteAllText: {
        ...typography.caption,
        color: colors.error,
        fontWeight: '600',
    },
    list: {
        padding: spacing.sm,
    },
    sectionContainer: {
        marginBottom: spacing.xs,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    sectionHeaderText: {
        ...typography.body,
        color: colors.textMedium,
        fontWeight: '600',
    },
    sectionHeaderCount: {
        ...typography.caption,
        color: colors.textWeak,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: radius.full,
        overflow: 'hidden',
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
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    statusBadge: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 4,
        borderRadius: radius.full,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
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
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingTop: 100,
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
});

/**
 * LocaAlert History Screen
 * Recent alarms history with swipe-to-delete, bulk delete, and detail navigation
 */

import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Alert, ActivityIndicator } from 'react-native';
import ReAnimated, { useAnimatedStyle, useSharedValue, withTiming, withSpring, interpolate, runOnJS, FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAlarmStore } from '../../src/stores/alarmStore';
import { Alarm } from '../../src/db/schema';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../../src/styles/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DELETE_BUTTON_WIDTH = 80;
const SNAP_THRESHOLD = 70;
const VELOCITY_THRESHOLD = 500;
const SPRING_CONFIG = { damping: 20, stiffness: 300, mass: 0.5, overshootClamping: true };

type AlarmStatus = 'in_progress' | 'completed' | 'cancelled';
type Styles = ReturnType<typeof createStyles>;

function getAlarmStatus(alarm: Alarm): AlarmStatus {
    if (alarm.is_active) return 'in_progress';
    if (alarm.arrived_at) return 'completed';
    return 'cancelled';
}

const StatusBadge = memo(function StatusBadge({ status, colors }: { status: AlarmStatus; colors: ThemeColors }) {
    const { t } = useTranslation();
    const config = {
        in_progress: { labelKey: 'history.status.inProgress', color: colors.success },
        completed: { labelKey: 'history.status.completed', color: colors.primary },
        cancelled: { labelKey: 'history.status.cancelled', color: colors.error },
    } as const;
    const { labelKey, color } = config[status];

    return (
        <View style={[statusBadgeStyles.badge, { backgroundColor: color }]}>
            <Text style={statusBadgeStyles.text}>{t(labelKey)}</Text>
        </View>
    );
});

const statusBadgeStyles = StyleSheet.create({
    badge: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 4,
        borderRadius: radius.full,
    },
    text: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

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
    styles: Styles;
}

function CollapsibleSection({ title, itemCount, isCollapsed, onToggle, children, colors, styles }: CollapsibleSectionProps) {
    return (
        <ReAnimated.View style={styles.sectionContainer} layout={LinearTransition.duration(250)}>
            <Pressable
                style={styles.sectionHeader}
                onPress={onToggle}
                accessibilityRole="button"
                accessibilityLabel={`${title}, ${itemCount} alarms`}
                accessibilityHint={isCollapsed ? 'Tap to expand' : 'Tap to collapse'}
                accessibilityState={{ expanded: !isCollapsed }}
            >
                <View style={styles.sectionHeaderLeft}>
                    <AnimatedChevron isCollapsed={isCollapsed} color={colors.textWeak} />
                    <Text style={styles.sectionHeaderText}>{title}</Text>
                </View>
                <Text style={styles.sectionHeaderCount}>{itemCount}</Text>
            </Pressable>

            {!isCollapsed && (
                <ReAnimated.View
                    entering={FadeInDown.duration(300).damping(18).stiffness(200)}
                    exiting={FadeOutUp.duration(200)}
                >
                    {children}
                </ReAnimated.View>
            )}
        </ReAnimated.View>
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
    const { alarms, isLoading, loadAlarms, deleteAlarm, deleteAllAlarms } = useAlarmStore();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    const sections = useMemo(() => groupAlarmsByDate(alarms, i18n), [alarms, i18n]);

    const toggleSection = useCallback((dateKey: string) => {
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
    }, []);

    useEffect(() => {
        loadAlarms();
    }, []);

    const handleAlarmPress = useCallback((alarm: Alarm) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/alarm-detail', params: { alarmId: alarm.id.toString() } });
    }, []);

    const handleDeleteAlarm = useCallback((alarm: Alarm) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        deleteAlarm(alarm.id);
    }, [deleteAlarm]);

    const handleDeleteAll = useCallback(() => {
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
    }, [t, deleteAllAlarms]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>{t('history.title')}</Text>
                    <Text style={styles.headerSubtitle}>{t('history.total', { count: alarms.length })}</Text>
                </View>
                {alarms.length > 0 && (
                    <Pressable
                        style={styles.deleteAllButton}
                        onPress={handleDeleteAll}
                        accessibilityRole="button"
                        accessibilityLabel={t('history.deleteAll.button')}
                        accessibilityHint="Deletes all alarm records"
                    >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                        <Text style={styles.deleteAllText}>{t('history.deleteAll.button')}</Text>
                    </Pressable>
                )}
            </View>

            <ScrollView
                contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
                showsVerticalScrollIndicator={false}
            >
                {isLoading && alarms.length === 0 ? (
                    <View style={styles.emptyState}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : sections.length === 0 ? (
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
                            styles={styles}
                        >
                            {section.data.map((alarm) => (
                                <SwipeableAlarmCard
                                    key={alarm.id}
                                    alarm={alarm}
                                    isActive={alarm.is_active}
                                    onPress={handleAlarmPress}
                                    onDelete={handleDeleteAlarm}
                                    colors={colors}
                                    styles={styles}
                                />
                            ))}
                        </CollapsibleSection>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const SwipeableAlarmCard = memo(function SwipeableAlarmCard({
    alarm,
    isActive,
    onPress,
    onDelete,
    colors,
    styles,
}: {
    alarm: Alarm;
    isActive: boolean;
    onPress: (alarm: Alarm) => void;
    onDelete: (alarm: Alarm) => void;
    colors: ThemeColors;
    styles: Styles;
}) {
    const { t, i18n } = useTranslation();
    const translateX = useSharedValue(0);
    const contextX = useSharedValue(0);
    const [isOpen, setIsOpen] = useState(false);

    const triggerHaptic = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const panGesture = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-5, 5])
        .onStart(() => {
            contextX.value = translateX.value;
            runOnJS(triggerHaptic)();
        })
        .onUpdate((e) => {
            const newX = contextX.value + e.translationX;
            translateX.value = Math.max(-DELETE_BUTTON_WIDTH * 2, Math.min(0, newX));
        })
        .onEnd((e) => {
            const shouldOpen =
                e.velocityX < -VELOCITY_THRESHOLD ||
                (Math.abs(e.velocityX) <= VELOCITY_THRESHOLD && translateX.value < -SNAP_THRESHOLD);

            if (shouldOpen) {
                translateX.value = withSpring(-DELETE_BUTTON_WIDTH, SPRING_CONFIG);
                runOnJS(setIsOpen)(true);
            } else {
                translateX.value = withSpring(0, SPRING_CONFIG);
                runOnJS(setIsOpen)(false);
            }
        });

    const cardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const deleteButtonStyle = useAnimatedStyle(() => {
        const progress = interpolate(
            -translateX.value,
            [0, DELETE_BUTTON_WIDTH],
            [0, 1],
            'clamp'
        );
        return {
            opacity: progress,
            transform: [{ scale: interpolate(progress, [0, 1], [0.5, 1]) }],
        };
    });

    const handleDeletePress = useCallback(() => {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 }, (finished) => {
            if (finished) {
                runOnJS(onDelete)(alarm);
            }
        });
    }, [onDelete, alarm]);

    const handlePress = useCallback(() => {
        if (isOpen) {
            translateX.value = withSpring(0, SPRING_CONFIG);
            setIsOpen(false);
        } else {
            onPress(alarm);
        }
    }, [isOpen, onPress, alarm]);

    return (
        <View style={styles.swipeContainer}>
            <ReAnimated.View style={[styles.deleteBackground, deleteButtonStyle]}>
                <Pressable
                    style={styles.deleteBackgroundButton}
                    onPress={handleDeletePress}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.delete')}
                    accessibilityHint={t('accessibility.deleteAlarmHint')}
                >
                    <Ionicons name="trash" size={24} color={colors.surface} />
                    <Text style={styles.deleteBackgroundText}>{t('common.delete')}</Text>
                </Pressable>
            </ReAnimated.View>

            <GestureDetector gesture={panGesture}>
                <ReAnimated.View style={[styles.alarmCard, cardAnimatedStyle]}>
                    <Pressable
                        onPress={handlePress}
                        style={styles.alarmCardInner}
                        accessibilityRole="button"
                        accessibilityLabel={t('accessibility.alarmHistoryCard', {
                            title: alarm.title,
                            status: t(`history.status.${getAlarmStatus(alarm)}`),
                            time: formatRelativeTime(alarm.created_at, t, i18n),
                        })}
                        accessibilityHint={t('accessibility.alarmDetails')}
                    >
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
                                {formatRelativeTime(alarm.created_at, t, i18n)}
                            </Text>
                        </View>
                    </Pressable>
                </ReAnimated.View>
            </GestureDetector>
        </View>
    );
});

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
        width: DELETE_BUTTON_WIDTH,
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

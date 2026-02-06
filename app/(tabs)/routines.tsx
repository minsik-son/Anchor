/**
 * LocaAlert Routines Screen
 * Recurring location-based alarms with time windows and repeat days
 */

import { useRef, useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    Animated,
    PanResponder,
    Dimensions,
    Alert,
    Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../../src/styles/theme';
import { useRoutineStore } from '../../src/stores/routineStore';
import { formatRepeatDays } from '../../src/data/mockRoutines';
import { evaluate } from '../../src/services/routineManager';
import type { Routine } from '../../src/stores/routineStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DELETE_THRESHOLD = 80;
const DELETE_CONFIRM_THRESHOLD = 160;

export default function Routines() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { routines, loadRoutines, toggleRoutine, deleteRoutine, deleteAllRoutines } = useRoutineStore();

    useFocusEffect(useCallback(() => { loadRoutines(); }, []));

    const handleRoutinePress = (routine: Routine) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/routine-setup', params: { routineId: routine.id } });
    };

    const handleDeleteRoutine = async (routine: Routine) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await deleteRoutine(Number(routine.id));
        evaluate();
    };

    const handleToggleRoutine = async (routine: Routine, enabled: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await toggleRoutine(Number(routine.id), enabled);
        evaluate();
    };

    const handleDeleteAll = () => {
        Alert.alert(
            t('routines.deleteAll.title'),
            t('routines.deleteAll.message'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('routines.deleteAll.confirm'),
                    style: 'destructive',
                    onPress: async () => {
                        await deleteAllRoutines();
                        evaluate();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    },
                },
            ]
        );
    };

    const handleAddRoutine = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/routine-setup');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>{t('routines.title')}</Text>
                    <Text style={styles.headerSubtitle}>{t('routines.total', { count: routines.length })}</Text>
                </View>
                {routines.length > 0 && (
                    <Pressable style={styles.deleteAllButton} onPress={handleDeleteAll}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                        <Text style={styles.deleteAllText}>{t('routines.deleteAll.button')}</Text>
                    </Pressable>
                )}
            </View>

            <FlatList
                data={routines}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <SwipeableRoutineCard
                        routine={item}
                        onPress={() => handleRoutinePress(item)}
                        onDelete={() => handleDeleteRoutine(item)}
                        onToggle={(enabled) => handleToggleRoutine(item, enabled)}
                        colors={colors}
                    />
                )}
                contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="repeat-outline" size={64} color={colors.textWeak} />
                        <Text style={styles.emptyText}>{t('routines.empty')}</Text>
                        <Text style={styles.emptySubtext}>{t('routines.emptyHint')}</Text>
                    </View>
                }
            />

            {/* Floating Add Button */}
            <Pressable
                style={({ pressed }) => [
                    styles.addButton,
                    { bottom: insets.bottom + 16 },
                    pressed && styles.addButtonPressed,
                ]}
                onPress={handleAddRoutine}
            >
                <Ionicons name="add" size={28} color={colors.surface} />
            </Pressable>
        </View>
    );
}

function SwipeableRoutineCard({
    routine,
    onPress,
    onDelete,
    onToggle,
    colors,
}: {
    routine: Routine;
    onPress: () => void;
    onDelete: () => void;
    onToggle: (enabled: boolean) => void;
    colors: ThemeColors;
}) {
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const translateX = useRef(new Animated.Value(0)).current;
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

    const timeRange = t('routines.timeRange', {
        start: routine.startTime,
        end: routine.endTime,
    });

    const repeatDaysText = formatRepeatDays(routine.repeatDays, t);

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
                    styles.routineCard,
                    { transform: [{ translateX }] },
                ]}
                {...panResponder.panHandlers}
            >
                <Pressable onPress={onPress} style={styles.routineCardInner}>
                    <View style={styles.routineHeader}>
                        <View style={styles.routineTitleContainer}>
                            <View style={[styles.iconCircle, !routine.isEnabled && styles.iconCircleDisabled]}>
                                <Ionicons
                                    name={routine.icon as any}
                                    size={20}
                                    color={routine.isEnabled ? colors.primary : colors.textWeak}
                                />
                            </View>
                            <View style={styles.routineInfo}>
                                <Text style={[styles.routineName, !routine.isEnabled && styles.routineNameDisabled]}>
                                    {routine.name}
                                </Text>
                                <Text style={styles.routineLocation} numberOfLines={1}>
                                    {routine.locationName}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={routine.isEnabled}
                            onValueChange={onToggle}
                            trackColor={{ false: colors.textWeak, true: colors.primary }}
                        />
                    </View>

                    <View style={styles.routineDetails}>
                        <View style={styles.detailItem}>
                            <Ionicons name="time-outline" size={14} color={colors.textWeak} />
                            <Text style={styles.detailText}>{timeRange}</Text>
                        </View>
                        <Text style={styles.detailDot}>•</Text>
                        <View style={styles.detailItem}>
                            <Ionicons name="calendar-outline" size={14} color={colors.textWeak} />
                            <Text style={styles.detailText}>{repeatDaysText}</Text>
                        </View>
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
    routineCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        ...shadows.button,
    },
    routineCardInner: {
        padding: spacing.sm,
    },
    routineHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    routineTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
        marginRight: spacing.sm,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: `${colors.primary}15`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircleDisabled: {
        backgroundColor: colors.background,
    },
    routineInfo: {
        flex: 1,
    },
    routineName: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
    },
    routineNameDisabled: {
        color: colors.textWeak,
    },
    routineLocation: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 2,
    },
    routineDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 52,
        gap: spacing.xs,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        ...typography.caption,
        color: colors.textWeak,
    },
    detailDot: {
        ...typography.caption,
        color: colors.textWeak,
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
        textAlign: 'center',
    },
    addButton: {
        position: 'absolute',
        right: spacing.md,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.card,
    },
    addButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.95 }],
    },
});

/**
 * LocaAlert History Screen
 * Recent alarms history
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAlarmStore } from '../../src/stores/alarmStore';
import { colors, typography, spacing, radius, shadows } from '../../src/styles/theme';
import { Alarm } from '../../src/db/schema';

export default function History() {
    const insets = useSafeAreaInsets();
    const { alarms, loadAlarms, deleteAlarm } = useAlarmStore();

    useEffect(() => {
        loadAlarms();
    }, []);

    const renderAlarmItem = ({ item }: { item: Alarm }) => (
        <View style={styles.alarmCard}>
            <View style={styles.alarmHeader}>
                <View style={styles.alarmTitleContainer}>
                    <Ionicons
                        name={item.is_active ? 'navigate-circle' : 'navigate-circle-outline'}
                        size={24}
                        color={item.is_active ? colors.primary : colors.textWeak}
                    />
                    <Text style={styles.alarmTitle}>{item.title}</Text>
                </View>
                <Pressable onPress={() => deleteAlarm(item.id)}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                </Pressable>
            </View>

            <View style={styles.alarmDetails}>
                <Text style={styles.alarmDetail}>
                    반경 {item.radius}m
                </Text>
                <Text style={styles.alarmDetail}>•</Text>
                <Text style={styles.alarmDetail}>
                    {new Date(item.created_at).toLocaleDateString('ko-KR')}
                </Text>
            </View>

            {item.is_active && (
                <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>활성화</Text>
                </View>
            )}
        </View>
    );

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
    alarmCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        ...shadows.button,
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
    },
    alarmDetail: {
        ...typography.caption,
        color: colors.textMedium,
    },
    activeBadge: {
        position: 'absolute',
        top: spacing.xs,
        right: spacing.xs,
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
});

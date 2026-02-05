/**
 * LocaAlert Settings Screen
 * App settings and preferences
 */

import { View, Text, StyleSheet, Pressable, Switch, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius, shadows } from '../../src/styles/theme';

export default function Settings() {
    const insets = useSafeAreaInsets();

    return (
        <ScrollView
            style={[styles.container, { paddingTop: insets.top }]}
            contentContainerStyle={{ paddingBottom: insets.bottom }}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>설정</Text>
            </View>

            {/* App Info */}
            <View style={styles.section}>
                <View style={styles.appInfo}>
                    <View style={styles.appIconContainer}>
                        <Text style={styles.appIcon}>📍</Text>
                    </View>
                    <View>
                        <Text style={styles.appName}>LocaAlert</Text>
                        <Text style={styles.appVersion}>버전 1.0.0</Text>
                    </View>
                </View>
            </View>

            {/* Location Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>위치 설정</Text>

                <SettingItem
                    icon="navigate"
                    label="백그라운드 위치 추적"
                    description="앱이 꺼진 상태에서도 위치 추적"
                    rightElement={<Switch value={true} />}
                />

                <SettingItem
                    icon="battery-charging"
                    label="배터리 세이빙 모드"
                    description="스마트 위치 체크 간격 사용"
                    rightElement={<Switch value={true} />}
                />
            </View>

            {/* Alarm Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>알람 설정</Text>

                <SettingItem
                    icon="volume-high"
                    label="스마트 볼륨"
                    description="목적지 접근 시 볼륨 점증"
                    rightElement={<Switch value={true} />}
                />

                <SettingItem
                    icon="vibrate"
                    label="진동"
                    description="알람 발생 시 진동 사용"
                    rightElement={<Switch value={true} />}
                />

                <SettingItem
                    icon="phone-portrait"
                    label="흔들어서 끄기"
                    description="폰을 흔들어 알람 일시정지"
                    rightElement={<Switch value={false} />}
                />
            </View>

            {/* Map Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>지도 설정</Text>

                <SettingItem
                    icon="map"
                    label="지도 엔진"
                    description="Google Maps"
                    rightElement={
                        <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                    }
                />
            </View>

            {/* About */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>정보</Text>

                <SettingItem
                    icon="help-circle"
                    label="도움말"
                    rightElement={
                        <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                    }
                />

                <SettingItem
                    icon="document-text"
                    label="개인정보 처리방침"
                    rightElement={
                        <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                    }
                />

                <SettingItem
                    icon="shield-checkmark"
                    label="오픈소스 라이선스"
                    rightElement={
                        <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
                    }
                />
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Made with ❤️ for better commuting
                </Text>
            </View>
        </ScrollView>
    );
}

function SettingItem({
    icon,
    label,
    description,
    rightElement,
}: {
    icon: string;
    label: string;
    description?: string;
    rightElement?: React.ReactNode;
}) {
    return (
        <Pressable style={styles.settingItem}>
            <View style={styles.settingLeft}>
                <Ionicons name={icon as any} size={24} color={colors.primary} />
                <View style={styles.settingContent}>
                    <Text style={styles.settingLabel}>{label}</Text>
                    {description && (
                        <Text style={styles.settingDescription}>{description}</Text>
                    )}
                </View>
            </View>
            {rightElement}
        </Pressable>
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
    section: {
        marginTop: spacing.md,
        backgroundColor: colors.surface,
        paddingVertical: spacing.xs,
    },
    sectionTitle: {
        ...typography.caption,
        color: colors.textWeak,
        fontWeight: '700',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    appInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
    },
    appIconContainer: {
        width: 64,
        height: 64,
        borderRadius: radius.md,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    appIcon: {
        fontSize: 32,
    },
    appName: {
        ...typography.heading,
        color: colors.textStrong,
    },
    appVersion: {
        ...typography.caption,
        color: colors.textWeak,
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    settingContent: {
        flex: 1,
    },
    settingLabel: {
        ...typography.body,
        color: colors.textStrong,
    },
    settingDescription: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 2,
    },
    footer: {
        paddingVertical: spacing.lg,
        alignItems: 'center',
    },
    footerText: {
        ...typography.caption,
        color: colors.textWeak,
    },
});

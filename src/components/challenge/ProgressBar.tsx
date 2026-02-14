/**
 * ProgressBar - Weekly progress visualization for challenges
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { typography, spacing, useThemeColors, ThemeColors } from '../../styles/theme';

interface ProgressBarProps {
    current: number;
    goal: number;
}

export function ProgressBar({ current, goal }: ProgressBarProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const percentage = Math.min((current / goal) * 100, 100);

    return (
        <View style={styles.container}>
            <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: `${percentage}%` }]} />
            </View>
            <Text style={styles.text}>
                {t('challenge.progress', { current, goal })}
            </Text>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    barBackground: {
        flex: 1,
        height: 8,
        backgroundColor: colors.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 4,
    },
    text: {
        ...typography.caption,
        fontWeight: '600',
        color: colors.textMedium,
        minWidth: 50,
        textAlign: 'right',
    },
});

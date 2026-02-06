/**
 * DayChips Component
 * Multi-select day of week chips with haptic feedback
 */

import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { typography, spacing, radius, useThemeColors, ThemeColors } from '../../styles/theme';

interface DayChipsProps {
    selectedDays: number[];  // 0=Sun, 1=Mon, ..., 6=Sat
    onDaysChange: (days: number[]) => void;
}

const DAYS = [
    { index: 0, key: 'sun' },
    { index: 1, key: 'mon' },
    { index: 2, key: 'tue' },
    { index: 3, key: 'wed' },
    { index: 4, key: 'thu' },
    { index: 5, key: 'fri' },
    { index: 6, key: 'sat' },
];

export function DayChips({ selectedDays, onDaysChange }: DayChipsProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleDayPress = (dayIndex: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const isSelected = selectedDays.includes(dayIndex);
        if (isSelected) {
            onDaysChange(selectedDays.filter(d => d !== dayIndex));
        } else {
            onDaysChange([...selectedDays, dayIndex].sort((a, b) => a - b));
        }
    };

    return (
        <View style={styles.container}>
            {DAYS.map((day) => {
                const isSelected = selectedDays.includes(day.index);
                const isWeekend = day.index === 0 || day.index === 6;

                return (
                    <Pressable
                        key={day.key}
                        style={[
                            styles.chip,
                            isSelected && styles.chipSelected,
                        ]}
                        onPress={() => handleDayPress(day.index)}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                isWeekend && styles.chipTextWeekend,
                                isSelected && styles.chipTextSelected,
                            ]}
                        >
                            {t(`days.${day.key}`)}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    chip: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.sm,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    chipSelected: {
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}15`,
    },
    chipText: {
        ...typography.body,
        color: colors.textMedium,
        fontWeight: '600',
    },
    chipTextWeekend: {
        color: colors.error,
    },
    chipTextSelected: {
        color: colors.primary,
    },
});

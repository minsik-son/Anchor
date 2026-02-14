/**
 * ComboBadge - Combo count with tier-based styling
 * 1: default, 3: silver, 5: gold, 10: special
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { typography, spacing, radius, useThemeColors, ThemeColors } from '../../styles/theme';

type ComboTier = 'default' | 'silver' | 'gold' | 'special';

function getComboTier(combo: number): ComboTier {
    if (combo >= 10) return 'special';
    if (combo >= 5) return 'gold';
    if (combo >= 3) return 'silver';
    return 'default';
}

const TIER_STYLES: Record<ComboTier, { borderColor: string; bgColor: string; textColor: string; icon: keyof typeof Ionicons.glyphMap | null }> = {
    default: { borderColor: '#E0E0E0', bgColor: '#F5F5F5', textColor: '#757575', icon: null },
    silver: { borderColor: '#B0BEC5', bgColor: '#ECEFF1', textColor: '#546E7A', icon: 'flame' },
    gold: { borderColor: '#FFD54F', bgColor: '#FFF8E1', textColor: '#F57F17', icon: 'flame' },
    special: { borderColor: '#FF6D00', bgColor: '#FFF3E0', textColor: '#E65100', icon: 'star' },
};

interface ComboBadgeProps {
    combo: number;
}

export function ComboBadge({ combo }: ComboBadgeProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const tier = getComboTier(combo);
    const tierStyle = TIER_STYLES[tier];
    const styles = useMemo(() => createStyles(colors), [colors]);

    if (combo === 0) return null;

    return (
        <View style={[styles.container, {
            borderColor: tierStyle.borderColor,
            backgroundColor: tierStyle.bgColor,
        }]}>
            {tierStyle.icon && (
                <Ionicons name={tierStyle.icon} size={12} color={tierStyle.textColor} />
            )}
            <Text style={[styles.text, { color: tierStyle.textColor }]}>
                {t('challenge.combo', { count: combo })}
            </Text>
        </View>
    );
}

export { getComboTier, TIER_STYLES };
export type { ComboTier };

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.xs,
        paddingVertical: 3,
        borderRadius: radius.sm,
        borderWidth: 1,
    },
    text: {
        ...typography.caption,
        fontWeight: '700',
        fontSize: 11,
    },
});

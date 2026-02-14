/**
 * IconBox - Challenge icon with colored background
 */

import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChallengeIcon } from '../../db/schema';

const ICON_CONFIG: Record<ChallengeIcon, {
    ionicon: keyof typeof Ionicons.glyphMap;
    color: string;
    bgColor: string;
}> = {
    fitness: { ionicon: 'fitness', color: '#3182F6', bgColor: '#E8F3FF' },
    walk: { ionicon: 'walk', color: '#00C853', bgColor: '#E6F9EE' },
    book: { ionicon: 'book', color: '#FF9800', bgColor: '#FFF3E0' },
    cafe: { ionicon: 'cafe', color: '#795548', bgColor: '#EFEBE9' },
    bicycle: { ionicon: 'bicycle', color: '#9C27B0', bgColor: '#F3E5F5' },
};

interface IconBoxProps {
    icon: ChallengeIcon;
    size?: number;
}

export function IconBox({ icon, size = 48 }: IconBoxProps) {
    const config = ICON_CONFIG[icon];
    const iconSize = size * 0.5;

    return (
        <View style={[styles.container, {
            width: size,
            height: size,
            borderRadius: size * 0.25,
            backgroundColor: config.bgColor,
        }]}>
            <Ionicons name={config.ionicon} size={iconSize} color={config.color} />
        </View>
    );
}

export { ICON_CONFIG };

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});

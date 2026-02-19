/**
 * Offline Banner - displayed when the device loses internet connectivity.
 * Position: top of screen, below safe area.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useThemeColors } from '../../styles/theme';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
    const { isConnected } = useNetworkStatus();
    const colors = useThemeColors();
    const { t } = useTranslation();

    if (isConnected) return null;

    return (
        <View style={[styles.banner, { backgroundColor: colors.error }]}>
            <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
            <Text style={styles.text}>{t('common.offlineMode')}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    text: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
});

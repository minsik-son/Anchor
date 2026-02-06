/**
 * TimePicker Component
 * Custom wheel-style time picker modal using FlatList
 */

import { useState, useRef, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    StyleSheet,
    FlatList,
    Dimensions,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../../styles/theme';

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface TimePickerProps {
    visible: boolean;
    value: string;  // "HH:mm" format
    onConfirm: (time: string) => void;
    onCancel: () => void;
}

// Generate hours (00-23) and minutes (00-59)
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

export function TimePicker({ visible, value, onConfirm, onCancel }: TimePickerProps) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [hour, minute] = value.split(':');
    const [selectedHour, setSelectedHour] = useState(hour || '00');
    const [selectedMinute, setSelectedMinute] = useState(minute || '00');

    const hourListRef = useRef<FlatList>(null);
    const minuteListRef = useRef<FlatList>(null);

    const handleConfirm = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onConfirm(`${selectedHour}:${selectedMinute}`);
    };

    const handleCancel = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onCancel();
    };

    const handleMomentumScrollEnd = useCallback((
        event: NativeSyntheticEvent<NativeScrollEvent>,
        items: string[],
        setSelected: (value: string) => void,
    ) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
        setSelected(items[clampedIndex]);
        Haptics.selectionAsync();
    }, []);

    const renderItem = useCallback(({ item, index }: { item: string; index: number }, selectedValue: string) => {
        const isSelected = item === selectedValue;
        return (
            <View style={[styles.item, isSelected && styles.itemSelected]}>
                <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                    {item}
                </Text>
            </View>
        );
    }, [styles]);

    const getItemLayout = useCallback((_: ArrayLike<string> | null | undefined, index: number) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
    }), []);

    // Scroll to initial position when modal opens
    const handleModalShow = () => {
        const hourIndex = HOURS.indexOf(selectedHour);
        const minuteIndex = MINUTES.indexOf(selectedMinute);

        setTimeout(() => {
            hourListRef.current?.scrollToOffset({ offset: hourIndex * ITEM_HEIGHT, animated: false });
            minuteListRef.current?.scrollToOffset({ offset: minuteIndex * ITEM_HEIGHT, animated: false });
        }, 100);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleCancel}
            onShow={handleModalShow}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={styles.title}>{t('timePicker.title')}</Text>

                    <View style={styles.pickerContainer}>
                        {/* Hour Picker */}
                        <View style={styles.pickerColumn}>
                            <Text style={styles.label}>{t('timePicker.hour')}</Text>
                            <View style={styles.pickerWrapper}>
                                <View style={styles.selectionIndicator} />
                                <FlatList
                                    ref={hourListRef}
                                    data={HOURS}
                                    keyExtractor={(item) => `hour-${item}`}
                                    renderItem={(props) => renderItem(props, selectedHour)}
                                    getItemLayout={getItemLayout}
                                    showsVerticalScrollIndicator={false}
                                    snapToInterval={ITEM_HEIGHT}
                                    decelerationRate="fast"
                                    contentContainerStyle={styles.listContent}
                                    onMomentumScrollEnd={(e) => handleMomentumScrollEnd(e, HOURS, setSelectedHour)}
                                />
                            </View>
                        </View>

                        <Text style={styles.separator}>:</Text>

                        {/* Minute Picker */}
                        <View style={styles.pickerColumn}>
                            <Text style={styles.label}>{t('timePicker.minute')}</Text>
                            <View style={styles.pickerWrapper}>
                                <View style={styles.selectionIndicator} />
                                <FlatList
                                    ref={minuteListRef}
                                    data={MINUTES}
                                    keyExtractor={(item) => `minute-${item}`}
                                    renderItem={(props) => renderItem(props, selectedMinute)}
                                    getItemLayout={getItemLayout}
                                    showsVerticalScrollIndicator={false}
                                    snapToInterval={ITEM_HEIGHT}
                                    decelerationRate="fast"
                                    contentContainerStyle={styles.listContent}
                                    onMomentumScrollEnd={(e) => handleMomentumScrollEnd(e, MINUTES, setSelectedMinute)}
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.buttonRow}>
                        <Pressable style={styles.cancelButton} onPress={handleCancel}>
                            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                        </Pressable>
                        <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                            <Text style={styles.confirmButtonText}>{t('common.confirm')}</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    container: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        width: '100%',
        maxWidth: 320,
        ...shadows.card,
    },
    title: {
        ...typography.heading,
        color: colors.textStrong,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    pickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    pickerColumn: {
        flex: 1,
        alignItems: 'center',
    },
    label: {
        ...typography.caption,
        color: colors.textWeak,
        marginBottom: spacing.xs,
    },
    pickerWrapper: {
        height: PICKER_HEIGHT,
        width: 80,
        overflow: 'hidden',
        position: 'relative',
    },
    selectionIndicator: {
        position: 'absolute',
        top: ITEM_HEIGHT * 2,
        left: 0,
        right: 0,
        height: ITEM_HEIGHT,
        backgroundColor: `${colors.primary}15`,
        borderRadius: radius.sm,
        zIndex: 1,
        pointerEvents: 'none',
    },
    listContent: {
        paddingVertical: ITEM_HEIGHT * 2,
    },
    item: {
        height: ITEM_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemSelected: {},
    itemText: {
        ...typography.heading,
        color: colors.textWeak,
    },
    itemTextSelected: {
        color: colors.primary,
        fontWeight: '700',
    },
    separator: {
        ...typography.heading,
        color: colors.textStrong,
        marginHorizontal: spacing.xs,
        marginTop: spacing.md,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: radius.md,
        backgroundColor: colors.background,
    },
    cancelButtonText: {
        ...typography.body,
        color: colors.textMedium,
        fontWeight: '600',
    },
    confirmButton: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: radius.md,
        backgroundColor: colors.primary,
    },
    confirmButtonText: {
        ...typography.body,
        color: colors.surface,
        fontWeight: '600',
    },
});

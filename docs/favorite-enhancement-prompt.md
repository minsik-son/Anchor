# 즐겨찾기 강화 구현 Prompt

## 개요

즐겨찾기 시스템을 3가지로 강화:
1. 아이콘 선택 UI → 탭하여 모달 피커
2. 요일/시간 스케줄 옵션 추가
3. 즐겨찾기 관리 페이지 신규 생성

---

## 파일 1: `src/stores/favoritePlaceStore.ts`

### 변경사항

**A) 인터페이스 확장**

```typescript
export interface FavoriteSchedule {
    enabled: boolean;
    days: number[];      // 0(일)~6(토), 빈 배열이면 매일
    startTime: string;   // "HH:mm"
    endTime: string;     // "HH:mm"
}

export interface FavoritePlace {
    id: string;
    label: string;
    icon: string;
    latitude: number;
    longitude: number;
    radius: number;
    schedule?: FavoriteSchedule;  // 신규
    isActive: boolean;            // 신규
}
```

**B) Store 인터페이스에 toggleActive 추가**

```typescript
interface FavoritePlaceStore {
    favorites: FavoritePlace[];
    isLoaded: boolean;
    loadFavorites: () => Promise<void>;
    addFavorite: (place: Omit<FavoritePlace, 'id'>) => Promise<void>;
    updateFavorite: (id: string, updates: Partial<Omit<FavoritePlace, 'id'>>) => Promise<void>;
    deleteFavorite: (id: string) => Promise<void>;
    toggleActive: (id: string) => Promise<void>;  // 신규
}
```

**C) loadFavorites 마이그레이션**

기존 데이터에 `isActive` 필드가 없을 수 있으므로 로드 시 기본값 적용:

```typescript
loadFavorites: async () => {
    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
            const raw = JSON.parse(stored);
            // 마이그레이션: isActive 없으면 true로 기본값
            const favorites = raw.map((fav: any) => ({
                ...fav,
                isActive: fav.isActive !== undefined ? fav.isActive : true,
            }));
            set({ favorites, isLoaded: true });
        } else {
            set({ isLoaded: true });
        }
    } catch (error) {
        console.error('[FavoritePlaceStore] Load error:', error);
        set({ isLoaded: true });
    }
},
```

**D) addFavorite에 isActive 기본값**

```typescript
const newPlace: FavoritePlace = {
    ...place,
    id: Date.now().toString(),
    isActive: place.isActive !== undefined ? place.isActive : true,
};
```

**E) toggleActive 구현**

```typescript
toggleActive: async (id) => {
    const { favorites } = get();
    const updated = favorites.map(fav =>
        fav.id === id ? { ...fav, isActive: !fav.isActive } : fav
    );
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        set({ favorites: updated });
    } catch (error) {
        console.error('[FavoritePlaceStore] Toggle error:', error);
        throw error;
    }
},
```

---

## 파일 2: `app/favorite-place-setup.tsx`

### 변경사항 3가지

**A) 아이콘 선택 → 모달 피커**

현재: 16개 아이콘이 4열 그리드로 항상 노출
변경: 선택된 아이콘 1개만 보이는 Pressable → 탭하면 Modal로 그리드 표시

```tsx
// 상태 추가
const [showIconPicker, setShowIconPicker] = useState(false);

// 기존 아이콘 그리드 대신:
<View style={styles.section}>
    <Text style={styles.label}>{t('favoriteSetup.iconLabel')}</Text>
    <Pressable
        style={styles.iconSelector}
        onPress={() => setShowIconPicker(true)}
    >
        <Ionicons name={selectedIcon as any} size={24} color={colors.primary} />
        <Text style={styles.iconSelectorText}>{selectedIcon}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textWeak} />
    </Pressable>
</View>

// Modal (return 바깥이 아니라 안에 추가):
{showIconPicker && (
    <Modal transparent animationType="fade" visible={showIconPicker}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowIconPicker(false)}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('favoriteSetup.iconLabel')}</Text>
                <View style={styles.iconGrid}>
                    {ICONS.map((icon) => (
                        <Pressable
                            key={icon}
                            style={[
                                styles.iconOption,
                                selectedIcon === icon && styles.iconOptionSelected,
                            ]}
                            onPress={() => {
                                setSelectedIcon(icon);
                                setShowIconPicker(false);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                        >
                            <Ionicons
                                name={icon as any}
                                size={24}
                                color={selectedIcon === icon ? colors.primary : colors.textMedium}
                            />
                        </Pressable>
                    ))}
                </View>
            </View>
        </Pressable>
    </Modal>
)}
```

새 스타일:
```typescript
iconSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
},
iconSelectorText: {
    ...typography.body,
    color: colors.textStrong,
    flex: 1,
},
modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
},
modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '80%',
},
modalTitle: {
    ...typography.heading,
    color: colors.textStrong,
    marginBottom: spacing.md,
    textAlign: 'center',
},
```

**B) 스케줄 설정 UI 추가**

아이콘 섹션과 위치 정보 섹션 사이에 스케줄 섹션 추가.

```tsx
// 상태 추가
const [scheduleEnabled, setScheduleEnabled] = useState(false);
const [selectedDays, setSelectedDays] = useState<number[]>([1,2,3,4,5]); // 월~금 기본
const [startTime, setStartTime] = useState('07:00');
const [endTime, setEndTime] = useState('09:00');
const [showStartTimePicker, setShowStartTimePicker] = useState(false);
const [showEndTimePicker, setShowEndTimePicker] = useState(false);

// 요일 토글 함수
const toggleDay = (day: number) => {
    setSelectedDays(prev =>
        prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

// 요일 레이블 (i18n 사용)
const dayLabels = [
    t('days.sun'), t('days.mon'), t('days.tue'), t('days.wed'),
    t('days.thu'), t('days.fri'), t('days.sat'),
];
```

스케줄 UI:
```tsx
<View style={styles.section}>
    <View style={styles.scheduleHeader}>
        <Text style={styles.label}>{t('favoriteSetup.scheduleLabel')}</Text>
        <Switch
            value={scheduleEnabled}
            onValueChange={setScheduleEnabled}
            trackColor={{ false: colors.textMedium, true: colors.primary }}
            ios_backgroundColor={colors.textMedium}
        />
    </View>

    {scheduleEnabled && (
        <View style={styles.scheduleContent}>
            {/* 요일 선택 */}
            <Text style={styles.scheduleSubLabel}>{t('favoriteSetup.daysLabel')}</Text>
            <View style={styles.daysRow}>
                {[0,1,2,3,4,5,6].map((day) => (
                    <Pressable
                        key={day}
                        style={[
                            styles.dayChip,
                            selectedDays.includes(day) && styles.dayChipSelected,
                        ]}
                        onPress={() => toggleDay(day)}
                    >
                        <Text style={[
                            styles.dayChipText,
                            selectedDays.includes(day) && styles.dayChipTextSelected,
                        ]}>
                            {dayLabels[day]}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* 시간 선택 */}
            <View style={styles.timeRow}>
                <View style={styles.timeBlock}>
                    <Text style={styles.scheduleSubLabel}>{t('favoriteSetup.startTime')}</Text>
                    <Pressable
                        style={styles.timeButton}
                        onPress={() => setShowStartTimePicker(true)}
                    >
                        <Ionicons name="time-outline" size={18} color={colors.primary} />
                        <Text style={styles.timeText}>{startTime}</Text>
                    </Pressable>
                </View>
                <Text style={styles.timeSeparator}>~</Text>
                <View style={styles.timeBlock}>
                    <Text style={styles.scheduleSubLabel}>{t('favoriteSetup.endTime')}</Text>
                    <Pressable
                        style={styles.timeButton}
                        onPress={() => setShowEndTimePicker(true)}
                    >
                        <Ionicons name="time-outline" size={18} color={colors.primary} />
                        <Text style={styles.timeText}>{endTime}</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    )}
</View>
```

시간 피커는 `@react-native-community/datetimepicker` 사용:
```tsx
import DateTimePicker from '@react-native-community/datetimepicker';

// startTime/endTime을 Date로 변환하는 유틸
const timeStringToDate = (time: string): Date => {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
};

const handleTimeChange = (type: 'start' | 'end', event: any, date?: Date) => {
    if (Platform.OS === 'android') {
        type === 'start' ? setShowStartTimePicker(false) : setShowEndTimePicker(false);
    }
    if (date) {
        const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        type === 'start' ? setStartTime(timeStr) : setEndTime(timeStr);
    }
};

// DateTimePicker 렌더링 (각 시간용)
{showStartTimePicker && (
    <DateTimePicker
        value={timeStringToDate(startTime)}
        mode="time"
        is24Hour={true}
        onChange={(e, d) => handleTimeChange('start', e, d)}
    />
)}
{showEndTimePicker && (
    <DateTimePicker
        value={timeStringToDate(endTime)}
        mode="time"
        is24Hour={true}
        onChange={(e, d) => handleTimeChange('end', e, d)}
    />
)}
```

스케줄 관련 스타일:
```typescript
scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
},
scheduleContent: {
    marginTop: spacing.sm,
    gap: spacing.sm,
},
scheduleSubLabel: {
    ...typography.caption,
    color: colors.textMedium,
    fontWeight: '600',
    marginBottom: 4,
},
daysRow: {
    flexDirection: 'row',
    gap: 6,
},
dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
},
dayChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
},
dayChipText: {
    ...typography.caption,
    color: colors.textMedium,
    fontWeight: '600',
},
dayChipTextSelected: {
    color: '#FFFFFF',
},
timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
},
timeBlock: {
    flex: 1,
},
timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
},
timeText: {
    ...typography.body,
    color: colors.textStrong,
    fontWeight: '600',
},
timeSeparator: {
    ...typography.body,
    color: colors.textWeak,
    paddingBottom: spacing.sm,
},
```

**C) 수정 모드 지원**

라우트 파라미터에 `editId` 추가:

```tsx
const params = useLocalSearchParams<{
    latitude: string;
    longitude: string;
    address?: string;
    radius?: string;
    editId?: string;  // 신규 - 수정 모드일 때 기존 즐겨찾기 ID
}>();

// 수정 모드 감지 및 데이터 로드
const existingFavorite = params.editId
    ? favorites.find(f => f.id === params.editId)
    : null;

// 초기값 설정 (useState에서)
const [label, setLabel] = useState(existingFavorite?.label ?? '');
const [selectedIcon, setSelectedIcon] = useState(existingFavorite?.icon ?? 'home');

// 스케줄 초기값
const [scheduleEnabled, setScheduleEnabled] = useState(
    existingFavorite?.schedule?.enabled ?? false
);
const [selectedDays, setSelectedDays] = useState<number[]>(
    existingFavorite?.schedule?.days ?? [1,2,3,4,5]
);
const [startTime, setStartTime] = useState(
    existingFavorite?.schedule?.startTime ?? '07:00'
);
const [endTime, setEndTime] = useState(
    existingFavorite?.schedule?.endTime ?? '09:00'
);
```

handleSave 수정:
```tsx
const handleSave = async () => {
    // ... 기존 validation 유지 ...

    // 수정 모드에서는 max limit 체크 스킵
    if (!params.editId && favorites.length >= 3) {
        Alert.alert(t('common.error'), t('favoriteSetup.maxLimitReached'));
        return;
    }

    const schedule: FavoriteSchedule | undefined = scheduleEnabled
        ? { enabled: true, days: selectedDays, startTime, endTime }
        : undefined;

    try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (params.editId) {
            // 수정 모드
            await updateFavorite(params.editId, {
                label: label.trim(),
                icon: selectedIcon,
                latitude: lat,
                longitude: lng,
                radius: savedRadius,
                schedule,
            });
        } else {
            // 신규 추가
            await addFavorite({
                label: label.trim(),
                icon: selectedIcon,
                latitude: lat,
                longitude: lng,
                radius: savedRadius,
                schedule,
                isActive: true,
            });
        }

        router.back();
    } catch (error) {
        console.error('[FavoritePlaceSetup] Failed to save:', error);
        Alert.alert(t('common.error'), t('common.saveFailed'));
    }
};
```

헤더 타이틀 동적 변경:
```tsx
<Text style={styles.headerTitle}>
    {params.editId ? t('favoriteSetup.editTitle') : t('favoriteSetup.title')}
</Text>
```

Import 추가:
```tsx
import { Modal, Switch, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FavoriteSchedule } from '../src/stores/favoritePlaceStore';
```

updateFavorite도 store에서 가져오기:
```tsx
const { addFavorite, updateFavorite, favorites } = useFavoritePlaceStore();
```

---

## 파일 3: `app/favorite-manage.tsx` (신규 생성)

즐겨찾기 관리 페이지. 알람 on/off 토글 리스트 스타일.

```tsx
/**
 * Favorite Places Management Screen
 * List of favorites with on/off toggles, edit, and delete
 */

import { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useFavoritePlaceStore, FavoritePlace } from '../src/stores/favoritePlaceStore';
import { typography, spacing, radius, shadows, useThemeColors, ThemeColors } from '../src/styles/theme';
import { useDistanceFormatter } from '../src/utils/distanceFormatter';

export default function FavoriteManage() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { favorites, toggleActive, deleteFavorite } = useFavoritePlaceStore();
    const { formatRadius } = useDistanceFormatter();

    const handleToggle = useCallback(async (id: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await toggleActive(id);
    }, [toggleActive]);

    const handleEdit = useCallback((fav: FavoritePlace) => {
        router.push({
            pathname: '/favorite-place-setup',
            params: {
                editId: fav.id,
                latitude: String(fav.latitude),
                longitude: String(fav.longitude),
                radius: String(fav.radius),
            },
        });
    }, []);

    const handleDelete = useCallback((fav: FavoritePlace) => {
        Alert.alert(
            t('home.deleteFavorite.title'),
            t('home.deleteFavorite.message', { name: fav.label }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('home.deleteFavorite.confirm'),
                    style: 'destructive',
                    onPress: async () => {
                        await deleteFavorite(fav.id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    },
                },
            ]
        );
    }, [t, deleteFavorite]);

    // 스케줄 요약 텍스트 생성
    const getScheduleSummary = useCallback((fav: FavoritePlace): string => {
        if (!fav.schedule?.enabled) return t('favoriteManage.noSchedule');

        const dayNames = [
            t('days.sun'), t('days.mon'), t('days.tue'), t('days.wed'),
            t('days.thu'), t('days.fri'), t('days.sat'),
        ];

        const days = fav.schedule.days.length === 0
            ? t('favoriteManage.everyday')
            : fav.schedule.days.length === 5 &&
              [1,2,3,4,5].every(d => fav.schedule!.days.includes(d))
                ? t('favoriteManage.weekdays')
                : fav.schedule.days.map(d => dayNames[d]).join(', ');

        return `${days} ${fav.schedule.startTime}~${fav.schedule.endTime}`;
    }, [t]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={colors.textStrong} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('favoriteManage.title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            >
                {favorites.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="star-outline" size={64} color={colors.textWeak} />
                        <Text style={styles.emptyText}>{t('favoriteManage.empty')}</Text>
                    </View>
                ) : (
                    favorites.map((fav) => (
                        <View key={fav.id} style={styles.favoriteCard}>
                            <View style={styles.favoriteLeft}>
                                <View style={[
                                    styles.iconCircle,
                                    !fav.isActive && styles.iconCircleInactive,
                                ]}>
                                    <Ionicons
                                        name={fav.icon as any}
                                        size={20}
                                        color={fav.isActive ? colors.primary : colors.textWeak}
                                    />
                                </View>
                                <View style={styles.favoriteInfo}>
                                    <Text style={[
                                        styles.favoriteLabel,
                                        !fav.isActive && styles.favoriteLabelInactive,
                                    ]}>
                                        {fav.label}
                                    </Text>
                                    <Text style={styles.favoriteSchedule}>
                                        {getScheduleSummary(fav)}
                                    </Text>
                                    <Text style={styles.favoriteRadius}>
                                        {formatRadius(fav.radius)}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.favoriteRight}>
                                <Switch
                                    value={fav.isActive}
                                    onValueChange={() => handleToggle(fav.id)}
                                    trackColor={{ false: colors.textMedium, true: colors.primary }}
                                    ios_backgroundColor={colors.textMedium}
                                />
                                <View style={styles.actionButtons}>
                                    <Pressable
                                        style={styles.actionButton}
                                        onPress={() => handleEdit(fav)}
                                    >
                                        <Ionicons name="create-outline" size={20} color={colors.textMedium} />
                                    </Pressable>
                                    <Pressable
                                        style={styles.actionButton}
                                        onPress={() => handleDelete(fav)}
                                    >
                                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    ))
                )}

                {/* 추가 버튼 (10개 미만일 때) */}
                {favorites.length < 10 && (
                    <Pressable
                        style={styles.addButton}
                        onPress={() => router.push('/favorite-place-setup')}
                    >
                        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                        <Text style={styles.addButtonText}>{t('favoriteManage.addNew')}</Text>
                    </Pressable>
                )}
            </ScrollView>
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
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.background,
    },
    headerTitle: {
        ...typography.heading,
        color: colors.textStrong,
    },
    backButton: {
        padding: spacing.xs,
        marginLeft: -spacing.xs,
    },
    content: {
        flex: 1,
        padding: spacing.md,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
        gap: spacing.sm,
    },
    emptyText: {
        ...typography.body,
        color: colors.textWeak,
        textAlign: 'center',
    },
    favoriteCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...shadows.card,
    },
    favoriteLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: spacing.sm,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: `${colors.primary}15`,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconCircleInactive: {
        backgroundColor: colors.background,
    },
    favoriteInfo: {
        flex: 1,
    },
    favoriteLabel: {
        ...typography.body,
        color: colors.textStrong,
        fontWeight: '600',
    },
    favoriteLabelInactive: {
        color: colors.textWeak,
    },
    favoriteSchedule: {
        ...typography.caption,
        color: colors.textMedium,
        marginTop: 2,
    },
    favoriteRadius: {
        ...typography.caption,
        color: colors.textWeak,
        marginTop: 1,
    },
    favoriteRight: {
        alignItems: 'flex-end',
        gap: spacing.xs,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    actionButton: {
        padding: 4,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.xs,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.primary,
    },
    addButtonText: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '600',
    },
});
```

---

## 파일 4: `app/_layout.tsx`

`<Stack>` 안에 Screen 추가:

```tsx
<Stack.Screen name="favorite-manage" options={{ headerShown: false }} />
```

`favorite-place-setup` 근처에 추가하면 됨.

---

## 파일 5: `app/(tabs)/settings.tsx`

"앱 설정" 섹션(`settings.sections.app`) 안에 즐겨찾기 관리 항목 추가.

`useFavoritePlaceStore` import 추가:
```tsx
import { useFavoritePlaceStore } from '../../src/stores/favoritePlaceStore';
```

컴포넌트 내에서:
```tsx
const { favorites } = useFavoritePlaceStore();
```

"앱 설정" 섹션의 마지막 SettingItem (distanceUnit) 뒤에 추가:

```tsx
<SettingItem
    icon="star"
    label={t('settings.items.favoriteManage')}
    description={t('settings.items.favoriteManageDesc', { count: favorites.length })}
    onPress={() => router.push('/favorite-manage')}
    rightElement={
        <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
    }
    colors={colors}
/>
```

---

## 파일 6: `src/components/home/BottomSheetDashboard.tsx`

즐겨찾기 헤더에 관리 페이지 바로가기 아이콘 추가.

import 추가:
```tsx
import { router } from 'expo-router';
```

기존 favoritesHeader 영역 수정:
```tsx
<Animated.View style={[styles.favoritesHeader, favoritesHeaderStyle]}>
    <Text style={styles.favoritesTitle}>{t('home.favorites')}</Text>
    <View style={styles.favoritesHeaderRight}>
        <Pressable
            style={styles.manageIconButton}
            onPress={() => router.push('/favorite-manage')}
        >
            <Ionicons name="settings-outline" size={16} color={colors.textMedium} />
        </Pressable>
        <Pressable style={styles.manageButton} onPress={toggleDeleteMode}>
            <Text style={styles.manageButtonText}>
                {isDeleteMode ? t('common.close') : t('common.edit')}
            </Text>
        </Pressable>
    </View>
</Animated.View>
```

새 스타일 추가:
```typescript
favoritesHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
},
manageIconButton: {
    padding: 4,
},
```

---

## 파일 7-9: i18n 번역

### ko.json 추가:

```json
"favoriteSetup": {
    "title": "즐겨찾기 추가",
    "editTitle": "즐겨찾기 수정",
    "nameLabel": "이름",
    "namePlaceholder": "예: 집, 회사, 카페",
    "iconLabel": "아이콘",
    "locationLabel": "위치",
    "save": "저장하기",
    "noName": "이름 필요",
    "pleaseEnterName": "즐겨찾기 이름을 입력해주세요.",
    "maxLimitReached": "즐겨찾기는 최대 3개까지 등록할 수 있습니다.",
    "scheduleLabel": "스케줄",
    "daysLabel": "요일",
    "startTime": "시작",
    "endTime": "종료"
},
"favoriteManage": {
    "title": "즐겨찾기 관리",
    "empty": "등록된 즐겨찾기가 없습니다.\n자주 가는 장소를 추가해보세요.",
    "addNew": "새 즐겨찾기 추가",
    "noSchedule": "스케줄 없음",
    "everyday": "매일",
    "weekdays": "평일"
},
"settings": {
    "items": {
        "favoriteManage": "즐겨찾기 관리",
        "favoriteManageDesc": "{{count}}개 등록됨"
    }
}
```

### en.json 추가:

```json
"favoriteSetup": {
    "title": "Add Favorite",
    "editTitle": "Edit Favorite",
    "nameLabel": "Name",
    "namePlaceholder": "e.g. Home, Office, Cafe",
    "iconLabel": "Icon",
    "locationLabel": "Location",
    "save": "Save",
    "noName": "Name Required",
    "pleaseEnterName": "Please enter a favorite name.",
    "maxLimitReached": "You can add up to 3 favorites.",
    "scheduleLabel": "Schedule",
    "daysLabel": "Days",
    "startTime": "Start",
    "endTime": "End"
},
"favoriteManage": {
    "title": "Manage Favorites",
    "empty": "No favorites yet.\nAdd your frequently visited places.",
    "addNew": "Add New Favorite",
    "noSchedule": "No schedule",
    "everyday": "Everyday",
    "weekdays": "Weekdays"
},
"settings": {
    "items": {
        "favoriteManage": "Manage Favorites",
        "favoriteManageDesc": "{{count}} registered"
    }
}
```

### ja.json 추가:

```json
"favoriteSetup": {
    "title": "お気に入り追加",
    "editTitle": "お気に入り編集",
    "nameLabel": "名前",
    "namePlaceholder": "例：家、会社、カフェ",
    "iconLabel": "アイコン",
    "locationLabel": "位置",
    "save": "保存する",
    "noName": "名前が必要です",
    "pleaseEnterName": "お気に入りの名前を入力してください。",
    "maxLimitReached": "お気に入りは最大3件まで登録できます。",
    "scheduleLabel": "スケジュール",
    "daysLabel": "曜日",
    "startTime": "開始",
    "endTime": "終了"
},
"favoriteManage": {
    "title": "お気に入り管理",
    "empty": "お気に入りがありません。\nよく行く場所を追加してみましょう。",
    "addNew": "新しいお気に入りを追加",
    "noSchedule": "スケジュールなし",
    "everyday": "毎日",
    "weekdays": "平日"
},
"settings": {
    "items": {
        "favoriteManage": "お気に入り管理",
        "favoriteManageDesc": "{{count}}件登録済み"
    }
}
```

**주의**: 기존 favoriteSetup 키는 유지하고 `editTitle`, `scheduleLabel`, `daysLabel`, `startTime`, `endTime`만 추가.
기존 settings.items에 `favoriteManage`, `favoriteManageDesc` 추가 (기존 키 건드리지 않기).

---

## 의존성 확인

`@react-native-community/datetimepicker`가 이미 설치되어 있는지 확인 필요. 없으면:
```bash
npx expo install @react-native-community/datetimepicker
```

---

## 구현 순서

1. `favoritePlaceStore.ts` 수정
2. `favorite-place-setup.tsx` 수정 (아이콘 모달 + 스케줄 + 수정모드)
3. `favorite-manage.tsx` 신규 생성
4. `_layout.tsx` Screen 추가
5. `settings.tsx` 메뉴 추가
6. `BottomSheetDashboard.tsx` 관리 아이콘 추가
7. i18n 3개 파일 번역 추가
8. `npx tsc --noEmit` TypeScript 체크

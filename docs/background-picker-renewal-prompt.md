# 배경화면 선택 UI 전면 개편 구현 지침서

## 개요
알람 트리거 화면의 배경화면 선택 UI를 전면 개편한다.
기존: settings.tsx 내 작은 모달(80% 너비)에서 리스트로 4개 프리셋 선택
변경: 별도 전체화면 갤러리 페이지에서 5개 테마 × 44개 이미지를 2열 그리드로 탐색/선택

---

## 1. 이미지 assets 구조 (이미 복사 완료)

```
assets/images/backgrounds/
├── pixel_dream/    (18장) pixel_dream_01.jpg ~ pixel_dream_18.jpg
├── aura/           (10장) aura_01.jpg ~ aura_10.jpg
├── into_the_wild/  (10장) wild_01.jpg ~ wild_10.jpg
├── city_lights/    (2장)  city_01.jpg ~ city_02.jpg
└── still_moment/   (4장)  still_01.jpg ~ still_04.jpg
```

---

## 2. alarmSettingsStore.ts 수정

### 2-1. 타입 변경

```typescript
// 기존 PresetKey 제거, 새로운 타입으로 교체
export type BackgroundType = 'default' | 'preset' | 'custom';

// 테마 카테고리 키
export type ThemeCategoryKey = 'pixel_dream' | 'aura' | 'into_the_wild' | 'city_lights' | 'still_moment';

// 프리셋 키는 "테마_번호" 형식 문자열
export type PresetKey = string;  // e.g. 'pixel_dream_01', 'aura_03', 'city_02'
```

### 2-2. BACKGROUND_THEMES 정의

기존 `ALARM_BACKGROUNDS` 를 제거하고 아래로 교체:

```typescript
export interface BackgroundImage {
    key: string;           // 고유 키 (e.g. 'pixel_dream_01')
    asset: number;         // require() 결과
}

export interface BackgroundTheme {
    key: ThemeCategoryKey;
    labelKey: string;      // i18n 키
    images: BackgroundImage[];
}

export const BACKGROUND_THEMES: BackgroundTheme[] = [
    {
        key: 'pixel_dream',
        labelKey: 'settings.backgroundThemes.pixelDream',
        images: [
            { key: 'pixel_dream_01', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_01.jpg') },
            { key: 'pixel_dream_02', asset: require('../../assets/images/backgrounds/pixel_dream/pixel_dream_02.jpg') },
            // ... pixel_dream_03 ~ pixel_dream_18 까지 총 18개
        ],
    },
    {
        key: 'aura',
        labelKey: 'settings.backgroundThemes.aura',
        images: [
            { key: 'aura_01', asset: require('../../assets/images/backgrounds/aura/aura_01.jpg') },
            // ... aura_02 ~ aura_10 까지 총 10개
        ],
    },
    {
        key: 'into_the_wild',
        labelKey: 'settings.backgroundThemes.intoTheWild',
        images: [
            { key: 'wild_01', asset: require('../../assets/images/backgrounds/into_the_wild/wild_01.jpg') },
            // ... wild_02 ~ wild_10 까지 총 10개
        ],
    },
    {
        key: 'city_lights',
        labelKey: 'settings.backgroundThemes.cityLights',
        images: [
            { key: 'city_01', asset: require('../../assets/images/backgrounds/city_lights/city_01.jpg') },
            { key: 'city_02', asset: require('../../assets/images/backgrounds/city_lights/city_02.jpg') },
        ],
    },
    {
        key: 'still_moment',
        labelKey: 'settings.backgroundThemes.stillMoment',
        images: [
            { key: 'still_01', asset: require('../../assets/images/backgrounds/still_moment/still_01.jpg') },
            // ... still_02 ~ still_04 까지 총 4개
        ],
    },
];

// 유틸리티: presetKey로 asset 찾기 (alarm-trigger.tsx에서 사용)
export function getBackgroundAsset(presetKey: string): number | null {
    for (const theme of BACKGROUND_THEMES) {
        const found = theme.images.find(img => img.key === presetKey);
        if (found) return found.asset;
    }
    return null;
}
```

### 2-3. Store 인터페이스

`selectedPreset` 타입을 `string`으로 변경 (기존 `PresetKey` 유니온 대신).
기본값은 `'pixel_dream_01'`로 변경.

기존 `ALARM_BACKGROUNDS` export와 `PRESET_KEYS` 관련 코드 모두 제거.

---

## 3. 신규 파일: app/background-picker.tsx

### 3-1. 화면 구조

```
┌─────────────────────────┐
│  ← 배경화면              │  ← 헤더 (뒤로가기 + 타이틀)
├─────────────────────────┤
│ [기본] [Pixel Dream] [Aura] [Into the Wild] ...  │  ← 가로 스크롤 칩
├─────────────────────────┤
│  ┌──────┐  ┌──────┐     │
│  │      │  │  ✓   │     │  ← 2열 그리드 (9:16 비율)
│  │      │  │      │     │
│  └──────┘  └──────┘     │
│  ┌──────┐  ┌──────┐     │
│  │      │  │      │     │
│  │      │  │      │     │
│  └──────┘  └──────┘     │
│          ...             │
│                          │
│  ┌──────────────────┐    │
│  │   갤러리에서 선택   │    │  ← 하단 갤러리 버튼
│  └──────────────────┘    │
└─────────────────────────┘
```

### 3-2. 상세 구현

**헤더:**
- 왼쪽: 뒤로가기 화살표 (`router.back()`)
- 중앙: "배경화면" 타이틀 (i18n: `settings.backgroundPicker.title`)
- SafeArea 적용

**테마 칩 (가로 스크롤):**
- `ScrollView horizontal` 또는 `FlatList horizontal`
- 첫 번째 칩: "기본" (default 배경 선택용, 아이콘만)
- 이후 5개 테마 칩: Pixel Dream, Aura, Into the Wild, City Lights, Still Moment
- 마지막 칩: "갤러리" (기기 사진첩에서 선택)
- 선택된 칩: `backgroundColor: colors.primary`, `color: '#FFFFFF'`
- 미선택 칩: `backgroundColor: colors.surface`, `color: colors.textStrong`
- 칩 사이 gap: 8
- 칩 `paddingHorizontal: 16`, `paddingVertical: 8`, `borderRadius: 20`

**그리드:**
- `FlatList` with `numColumns={2}`
- 각 카드: `{ flex: 1, aspectRatio: 9/16, margin: 6, borderRadius: 12, overflow: 'hidden' }`
- 카드 내부: `Image` with `resizeMode="cover"`
- 현재 선택된 이미지에는 오버레이: 반투명 파란 배경 + 체크마크 아이콘
- "기본" 탭 선택 시: 기본 빨간 그라데이션 카드 1개만 표시
- "갤러리" 탭 선택 시: ImagePicker 바로 실행 (갤러리에서 사진 선택)

**이미지 선택 동작:**
- 이미지 탭 → 즉시 선택 (store에 저장) + `router.back()` 으로 settings로 복귀
- 선택 시 `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`
- store 업데이트: `setBackgroundType('preset')`, `setSelectedPreset(image.key)`

**기본 배경 선택 동작:**
- "기본" 칩 탭 또는 기본 카드 탭 → `setBackgroundType('default')` + `router.back()`

**갤러리 동작:**
- "갤러리" 칩 탭 → ImagePicker.launchImageLibraryAsync 실행
- 선택 완료 시: `setBackgroundType('custom')`, `setCustomImageUri(uri)`, `router.back()`

**imports:**
```typescript
import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useAlarmSettingsStore, BACKGROUND_THEMES, ThemeCategoryKey } from '../src/stores/alarmSettingsStore';
import { useThemeColors, ThemeColors, typography, spacing, radius } from '../src/styles/theme';
```

### 3-3. 스타일 가이드

- 전체 배경: `colors.background`
- 카드 borderRadius: `radius.md` (12)
- 선택 오버레이: `backgroundColor: 'rgba(49, 130, 246, 0.3)'` + 중앙 체크마크 (Ionicons "checkmark-circle", size 40, color '#FFFFFF')
- 하단 여백: `insets.bottom + spacing.lg`

---

## 4. app/_layout.tsx 수정

`background-picker` Stack.Screen 추가:

```tsx
<Stack.Screen
    name="background-picker"
    options={{
        headerShown: false,
        animation: 'slide_from_right',
    }}
/>
```

---

## 5. app/(tabs)/settings.tsx 수정

### 5-1. 제거할 것
- `showBackgroundModal` state 제거
- `handleBackgroundSelect` 함수 제거
- `handleGalleryPick` 함수 제거
- `getBackgroundLabel` 함수 수정 (BACKGROUND_THEMES에서 이름 찾기)
- Background Picker Modal JSX 전체 제거 (`{showBackgroundModal && (` ... `)}`)
- `ALARM_BACKGROUNDS` import 제거
- `PRESET_KEYS` 관련 코드 제거
- `ImagePicker` import 제거 (settings에서 더이상 사용 안함)
- 스타일에서 `presetPreview` 제거

### 5-2. 변경할 것

배경화면 SettingItem의 `onPress`를 모달 대신 라우터로 변경:

```tsx
<SettingItem
    icon="image"
    label={t('settings.items.alarmBackground')}
    description={getBackgroundLabel()}
    onPress={() => router.push('/background-picker')}
    rightElement={
        <Ionicons name="chevron-forward" size={20} color={colors.textWeak} />
    }
    colors={colors}
/>
```

`getBackgroundLabel` 수정:
```typescript
import { BACKGROUND_THEMES, getBackgroundAsset } from '../src/stores/alarmSettingsStore';

const getBackgroundLabel = () => {
    if (backgroundType === 'custom') return t('settings.backgroundPicker.gallery');
    if (backgroundType === 'preset') {
        // 테마 이름 찾기
        for (const theme of BACKGROUND_THEMES) {
            if (theme.images.some(img => img.key === selectedPreset)) {
                return t(theme.labelKey);
            }
        }
    }
    return t('settings.backgroundPicker.default');
};
```

---

## 6. app/alarm-trigger.tsx 수정

기존:
```typescript
import { useAlarmSettingsStore, ALARM_BACKGROUNDS } from '../src/stores/alarmSettingsStore';

const backgroundSource = useMemo(() => {
    if (backgroundType === 'preset') return ALARM_BACKGROUNDS[selectedPreset]?.asset;
    if (backgroundType === 'custom' && customImageUri) return { uri: customImageUri };
    return null;
}, [backgroundType, selectedPreset, customImageUri]);
```

변경:
```typescript
import { useAlarmSettingsStore, getBackgroundAsset } from '../src/stores/alarmSettingsStore';

const backgroundSource = useMemo(() => {
    if (backgroundType === 'preset') {
        const asset = getBackgroundAsset(selectedPreset);
        return asset ?? null;
    }
    if (backgroundType === 'custom' && customImageUri) return { uri: customImageUri };
    return null;
}, [backgroundType, selectedPreset, customImageUri]);
```

---

## 7. i18n 키 추가

### ko.json
```json
"settings": {
    "backgroundThemes": {
        "pixelDream": "Pixel Dream",
        "aura": "Aura",
        "intoTheWild": "Into the Wild",
        "cityLights": "City Lights",
        "stillMoment": "Still Moment"
    }
}
```

### en.json (동일)
```json
"settings": {
    "backgroundThemes": {
        "pixelDream": "Pixel Dream",
        "aura": "Aura",
        "intoTheWild": "Into the Wild",
        "cityLights": "City Lights",
        "stillMoment": "Still Moment"
    }
}
```

### ja.json (동일)
```json
"settings": {
    "backgroundThemes": {
        "pixelDream": "Pixel Dream",
        "aura": "Aura",
        "intoTheWild": "Into the Wild",
        "cityLights": "City Lights",
        "stillMoment": "Still Moment"
    }
}
```

테마 이름은 영문 브랜드 네이밍이므로 3개 언어 모두 동일하게 영문 사용.

---

## 8. 기존 프리셋 하위호환

기존에 'sunset', 'ocean', 'aurora', 'night' 프리셋을 사용하던 유저가 있을 수 있음.
`getBackgroundAsset` 에서 못 찾으면 null 반환 → alarm-trigger에서 null이면 기본 배경 사용.
이렇게 하면 기존 유저도 자연스럽게 기본 배경으로 폴백됨.

---

## 9. 주의사항

- React Native에서 `require()`는 동적 경로를 지원하지 않으므로, 44개 이미지 모두 정적으로 require 해야 함
- FlatList에서 `numColumns` 사용 시 `key` prop에 주의
- 이미지 용량이 크므로 (각 2~3MB) Image 컴포넌트에 적절한 캐싱/리사이징 고려
- 다크모드/라이트모드 모두 테스트 필요
- `aspectRatio: 9/16` 은 세로형 카드에 적합 (실제로는 약 0.5625)

---

## 수정 파일 요약

| # | 파일 | 작업 |
|---|------|------|
| 1 | `src/stores/alarmSettingsStore.ts` | 타입 변경, BACKGROUND_THEMES 추가, ALARM_BACKGROUNDS 제거 |
| 2 | `app/background-picker.tsx` | 신규 생성 (전체화면 갤러리) |
| 3 | `app/_layout.tsx` | background-picker 라우트 등록 |
| 4 | `app/(tabs)/settings.tsx` | 모달 제거, router.push 변경 |
| 5 | `app/alarm-trigger.tsx` | getBackgroundAsset 사용으로 변경 |
| 6 | `src/i18n/locales/ko.json` | backgroundThemes 키 추가 |
| 7 | `src/i18n/locales/en.json` | backgroundThemes 키 추가 |
| 8 | `src/i18n/locales/ja.json` | backgroundThemes 키 추가 |

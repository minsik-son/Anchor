# 알람 종료 후 현재 위치로 자동 복귀 구현 지침서

## 목적
알람 사이클(완료 또는 취소)이 끝나고 메인 페이지(Home)에 돌아왔을 때, 지도가 자동으로 사용자의 현재 위치로 이동하도록 한다. 이는 오른쪽 상단 "현재 위치" 버튼을 누른 것과 동일한 모션과 효과를 제공한다.

## 배경 분석

### 알람 종료 흐름
1. **메모 없는 경우**: `alarm-trigger.tsx` → `handleDismiss()` → `completeAlarm()` + `stopTracking()` → `router.back()` → Home
2. **메모 있는 경우**: `alarm-trigger.tsx` → `action-checklist.tsx` → `handleDone()` → `router.replace('/(tabs)/home')` → Home

두 경로 모두 `activeAlarm`이 truthy에서 null/undefined로 전환됨.

### 현재 위치 버튼 동작 (`handleMyLocationPress`)
```typescript
const handleMyLocationPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const location = await getCurrentLocation();
    if (location) {
        const myLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        };
        pinActions.moveToLocation(myLocation, 500);
    } else {
        console.log('[Home] Could not get current location');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}, [getCurrentLocation, pinActions]);
```

## 대상 파일
`app/(tabs)/home.tsx`

## 변경 사항

### 1. useRef import 추가

기존 import 라인:
```typescript
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
```

이미 `useRef`가 포함되어 있으므로 import 변경 불필요.

### 2. 이전 activeAlarm 상태를 추적하는 ref 추가

위치: `Home` 컴포넌트 내부, 기존 state/ref 선언 근처 (예: `hintOpacity` ref 바로 다음)

추가할 코드:
```typescript
const prevActiveAlarmRef = useRef<typeof activeAlarm>(activeAlarm);
```

### 3. activeAlarm 전환 감지 useEffect 추가

위치: 기존 useEffect 블록들 사이에 추가. `// Load memos when activeAlarm changes` useEffect 바로 다음이 적절.

추가할 코드:
```typescript
// Auto-return to current location when alarm cycle ends
useEffect(() => {
    const wasActive = prevActiveAlarmRef.current;
    prevActiveAlarmRef.current = activeAlarm;

    // Alarm just completed or cancelled → move map to current location
    if (wasActive && !activeAlarm) {
        handleMyLocationPress();
    }
}, [activeAlarm, handleMyLocationPress]);
```

### 동작 원리

1. `prevActiveAlarmRef`는 이전 렌더의 `activeAlarm` 값을 보관
2. `activeAlarm`이 변경될 때마다 useEffect 실행
3. 이전 값이 truthy(알람이 있었음)이고 현재 값이 falsy(알람 종료됨)이면 → `handleMyLocationPress()` 호출
4. 초기 마운트 시에는 발동 안 함:
   - 알람 없이 시작: `prevRef = null`, `activeAlarm = null` → 조건 미충족
   - 알람 있이 시작: `prevRef = alarm`, `activeAlarm = alarm` → wasActive && !activeAlarm 미충족

### 커버되는 시나리오

| 시나리오 | wasActive | activeAlarm | 트리거됨? |
|---------|-----------|-------------|----------|
| 앱 초기 로드 (알람 없음) | null | null | ❌ |
| 앱 초기 로드 (알람 있음) | alarm | alarm | ❌ |
| 알람 생성 | null | alarm | ❌ |
| 알람 완료 후 복귀 | alarm | null | ✅ |
| 알람 취소 후 | alarm | null | ✅ |

## 검증 방법
1. `npx tsc --noEmit` — TypeScript 에러 없음 확인
2. 알람 생성 → 목적지 도착 → 알람 해제 → Home 복귀 시 지도가 현재 위치로 자동 이동 확인
3. 알람 생성 → 대시보드에서 취소 → 지도가 현재 위치로 자동 이동 확인
4. 앱 최초 로드 시 불필요한 위치 이동이 발생하지 않는지 확인
5. 체크리스트(action-checklist) 경유 후 Home 복귀 시에도 동일하게 동작 확인

## 주의사항
- `handleMyLocationPress`는 `useCallback`으로 감싸져 있으므로 dependency array에 반드시 포함
- `handleMyLocationPress` 내부에서 Haptics를 두 번 호출하고 있음 (Light + Medium). 자동 복귀 시에는 Haptics 없이 조용히 이동하고 싶다면 별도의 `moveToCurrentLocation` 함수를 만들어서 Haptics를 제외하는 것도 고려 가능. 현재 설계에서는 동일한 피드백을 제공하여 사용자에게 "위치가 이동됐다"는 것을 명확히 인지시킴
- `router.replace('/(tabs)/home')`은 Home 컴포넌트를 새로 마운트하지 않고 이미 마운트된 탭으로 돌아감. 따라서 useEffect의 activeAlarm 감지가 정상 동작함

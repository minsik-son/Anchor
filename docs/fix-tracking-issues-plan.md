# 트래킹 3대 버그 수정 플랜

## 문제 요약

| # | 문제 | 원인 | 심각도 |
|---|------|------|--------|
| 1 | 알림이 알람 완료/취소 후에도 남아있음 | 취소 흐름에서 clearTrackingNotification 미호출 + dismissNotificationAsync만 사용 | HIGH |
| 2 | 경로 폴리라인 끊김 + 이동거리 미집계 | GEOFENCING 단계에서 위치 업데이트 없음 → 경로 수집 불가 | HIGH |
| 3 | 히스토리 알람상세에 경로 미표시 + 취소시간 없음 | 경로 데이터 DB 미저장, cancelled_at 컬럼 없음 | MEDIUM |

---

## 문제 1: 알림 잔존 + 취소 시 정리 누락

### 원인 분석

**A. 취소 흐름에서 알림 정리 누락**

`home.tsx`의 `handleCancelAlarm` (line 417-423):
```typescript
onPress: async () => {
    if (activeAlarm) {
        await deactivateAlarm(activeAlarm.id);  // DB만 업데이트
    }
    stopTracking();  // locationStore.stopTracking() 호출
    // ❌ clearTrackingNotification() 미호출!
    // ❌ stopTrackingActivity() 미호출! (Live Activity)
};
```

`locationStore.stopTracking()`은 `locationService.stopAllTracking()`을 호출하는데, 이 함수 안에서 `clearTrackingNotification()`과 `stopTrackingActivity()`를 호출함. **하지만** `stopAllTracking()`은 async이고 `.catch()`로 에러만 잡고 있어서 실제 실행 순서가 보장되지 않음.

**B. `dismissNotificationAsync` vs `cancelScheduledNotificationAsync`**

현재 `clearTrackingNotification()`은:
```typescript
await Notifications.dismissNotificationAsync('tracking-update');
```
`dismissNotificationAsync`는 알림 트레이에서 제거하지만, iOS에서 이미 표시된 notification을 확실히 제거하려면 `cancelScheduledNotificationAsync`도 함께 호출해야 함.

**C. 네비게이션 취소 흐름도 동일 문제**

`home.tsx` line 712-719의 `onStopNavigation`도 `clearTrackingNotification` 미호출.

### 해결 방안

1. `clearTrackingNotification()`에 `cancelScheduledNotificationAsync` 추가
2. `home.tsx`의 취소/네비게이션 종료 흐름에서 명시적 알림+Live Activity 정리

### 수정 파일

| 파일 | 변경 |
|------|------|
| `src/services/notification/notificationService.ts` | `clearTrackingNotification`에 cancel 추가 |
| `app/(tabs)/home.tsx` | 취소 흐름에 알림/LA 정리 추가 |

---

## 문제 2: 경로 수집 끊김 + 이동거리 미집계

### 원인 분석

**A. GEOFENCING 단계에서 경로 수집 불가**

`locationService.ts`의 3단계 추적 시스템:
- `GEOFENCING` (>5km): `Location.startGeofencingAsync()` — **위치 업데이트 없음**, 진입/탈출만 감지
- `ADAPTIVE_POLLING` (1.5-5km): `Location.startLocationUpdatesAsync()` — 위치 업데이트 있음 ✓
- `ACTIVE_TRACKING` (<1.5km): `Location.startLocationUpdatesAsync()` — 고빈도 위치 업데이트 ✓

`addRoutePoint()`는 `TASK_NAMES.LOCATION` 태스크 안에서만 호출됨 (line 197-203).
GEOFENCING 단계에서는 LOCATION 태스크가 실행되지 않으므로 **경로가 전혀 수집되지 않음**.

→ 사용자가 20km 떨어진 곳에서 알람을 설정하면, 처음 15km (GEOFENCING)는 경로 없음.
→ 5km 이내 진입 후에야 경로 수집 시작 → 폴리라인 끊김.

**B. ADAPTIVE_POLLING의 동적 쿨다운**

`locationService.ts` line 181-190:
```typescript
if (currentServicePhase === 'ADAPTIVE_POLLING') {
    if (now - lastProcessedAt < cooldown) {
        return;  // ← 이 return이 addRoutePoint도 스킵시킴!
    }
}
```

쿨다운으로 스킵된 위치 업데이트에서도 `addRoutePoint`가 호출되지 않아 경로에 구멍이 생김.

### 해결 방안

**핵심 전략: GEOFENCING 단계에서도 저전력 위치 수집 병행**

GEOFENCING일 때도 저빈도 위치 업데이트를 함께 실행하여 경로 수집:
- GEOFENCING + 저빈도 Location Updates (distanceInterval: 200m, timeInterval: 60s)
- 배터리 최적화를 유지하면서 경로만 수집

**추가: 쿨다운 스킵 시에도 경로 수집**

ADAPTIVE_POLLING에서 쿨다운으로 `return`하기 전에 `addRoutePoint`는 실행:
```typescript
if (now - lastProcessedAt < cooldown) {
    // 쿨다운 스킵이지만 경로 수집은 함
    if (store.isTracking) {
        store.addRoutePoint({ ... });
    }
    return;
}
```

### 수정 파일

| 파일 | 변경 |
|------|------|
| `src/services/location/locationService.ts` | GEOFENCING 시 저빈도 위치 수집 병행, 쿨다운 스킵 시 경로 수집 |
| `src/constants/trackingConfig.ts` | GEOFENCING 위치 수집 설정 추가 |

---

## 문제 3: 히스토리 경로 미표시 + 취소시간 없음 + 직선거리만 표시

### 원인 분석

**A. 경로 데이터 미저장**

`routeHistory`는 `locationStore`의 인메모리 상태. `stopAllTracking()` 호출 시 `clearRouteHistory()`로 삭제.
DB에 경로를 저장하는 코드가 없음.

**B. cancelled_at 컬럼 없음**

DB 스키마에 `arrived_at`은 있지만 `cancelled_at`은 없음. `deactivateAlarm`은 `is_active: false`만 설정.
→ 히스토리에서 취소된 알람의 취소 시간을 알 수 없음.

**C. 이동거리가 직선거리로 표시**

`alarm-detail.tsx` line 103-110:
```typescript
const meters = calculateDistance(
    { latitude: alarm.start_latitude, longitude: alarm.start_longitude },
    { latitude: alarm.latitude, longitude: alarm.longitude }
);
```
시작점→목적지 직선 거리(haversine)만 계산. 실제 이동 거리(traveled_distance)는 DB에 없음.

### 해결 방안

**A. DB 스키마 확장**

```sql
ALTER TABLE alarms ADD COLUMN route_points TEXT;           -- JSON: RoutePoint[]
ALTER TABLE alarms ADD COLUMN traveled_distance REAL;      -- 실제 이동 거리 (meters)
ALTER TABLE alarms ADD COLUMN cancelled_at TEXT;           -- 취소 시간
```

**B. 알람 완료/취소 시 경로 데이터 저장**

- `completeAlarm`: routeHistory + traveledDistance를 DB에 저장 후 clearRouteHistory
- `deactivateAlarm`: 동일하게 저장 + cancelled_at 기록

**C. alarm-detail.tsx 경로 폴리라인 표시**

- DB에서 route_points JSON 파싱
- MapView에 Polyline 렌더링 (녹색)
- 직선거리 대신 실제 이동거리 표시
- 취소된 알람이면 cancelled_at 표시

### 수정 파일

| 파일 | 변경 |
|------|------|
| `src/db/schema.ts` | route_points, traveled_distance, cancelled_at 컬럼 + 타입 추가 |
| `src/db/database.ts` | migration 추가, updateAlarm에 새 필드 지원 |
| `src/stores/alarmStore.ts` | completeAlarm/deactivateAlarm에 경로 저장 로직 |
| `app/alarm-detail.tsx` | 경로 폴리라인, 실제 이동거리, 취소시간 표시 |
| `src/i18n/locales/ko.json` | 취소시간 번역 키 |
| `src/i18n/locales/en.json` | 취소시간 번역 키 |
| `src/i18n/locales/ja.json` | 취소시간 번역 키 |

---

## 전체 수정 파일 요약

| # | 파일 | 문제 |
|---|------|------|
| 1 | `src/services/notification/notificationService.ts` | 1 |
| 2 | `app/(tabs)/home.tsx` | 1 |
| 3 | `src/services/location/locationService.ts` | 2 |
| 4 | `src/constants/trackingConfig.ts` | 2 |
| 5 | `src/db/schema.ts` | 3 |
| 6 | `src/db/database.ts` | 3 |
| 7 | `src/stores/alarmStore.ts` | 3 |
| 8 | `app/alarm-detail.tsx` | 3 |
| 9 | `src/i18n/locales/ko.json`, `en.json`, `ja.json` | 3 |

---

## 구현 순서

1. **문제 1 (알림 잔존)** — 가장 간단, 즉시 효과
   - notificationService.ts: clearTrackingNotification 강화
   - home.tsx: 취소 흐름에 알림 정리 추가

2. **문제 2 (경로 수집)** — 핵심 수정
   - trackingConfig.ts: GEOFENCING 위치 수집 설정
   - locationService.ts: GEOFENCING 병행 수집 + 쿨다운 스킵 시 경로 수집

3. **문제 3 (히스토리 경로)** — DB 변경 포함
   - schema.ts + database.ts: 마이그레이션
   - alarmStore.ts: 완료/취소 시 경로 저장
   - alarm-detail.tsx: UI 업데이트
   - i18n: 번역 추가

4. **TypeScript 체크**

---

## 상세 코드 변경

### 1. notificationService.ts — clearTrackingNotification 강화

```typescript
export async function clearTrackingNotification(): Promise<void> {
    try {
        await Notifications.dismissNotificationAsync('tracking-update');
        await Notifications.cancelScheduledNotificationAsync('tracking-update');
    } catch {
        // 알림이 이미 없을 수 있음 — 무시
    }
}
```

### 2. home.tsx — 취소 흐름

```typescript
import { clearTrackingNotification } from '../../src/services/notification/notificationService';
import { stopTrackingActivity } from '../../src/services/liveActivity/liveActivityService';

// handleCancelAlarm:
onPress: async () => {
    if (activeAlarm) {
        await deactivateAlarm(activeAlarm.id);
    }
    stopTracking();
    await stopTrackingActivity();
    await clearTrackingNotification();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
},

// onStopNavigation: 동일하게 추가
```

### 3. locationService.ts — GEOFENCING 병행 위치 수집

setupGeofencing에서 geofencing과 함께 저빈도 location updates도 시작:

```typescript
async function setupGeofencing(): Promise<void> {
    if (!currentTarget) return;
    try {
        await Location.startGeofencingAsync(TASK_NAMES.GEOFENCE, [{ ... }]);
        geofenceSetupFailed = false;

        // 경로 수집용 저빈도 위치 업데이트 병행 시작
        await Location.startLocationUpdatesAsync(TASK_NAMES.LOCATION, {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: GEOFENCING_ROUTE_CONFIG.DISTANCE_INTERVAL,
            timeInterval: GEOFENCING_ROUTE_CONFIG.TIME_INTERVAL,
            foregroundService: {
                notificationTitle: 'LocaAlert 실행 중',
                notificationBody: '목적지 도착을 알려드릴게요',
                notificationColor: '#3182F6',
            },
            activityType: Location.ActivityType.OtherNavigation,
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
        });
    } catch (err) { ... }
}
```

teardownPhase도 수정 — GEOFENCING teardown 시 LOCATION task도 정리:
```typescript
if (phase === 'GEOFENCING') {
    const hasGeo = await Location.hasStartedGeofencingAsync(TASK_NAMES.GEOFENCE);
    if (hasGeo) await Location.stopGeofencingAsync(TASK_NAMES.GEOFENCE);
    // GEOFENCING에서도 LOCATION 태스크 사용하므로 정리
    const hasLoc = await Location.hasStartedLocationUpdatesAsync(TASK_NAMES.LOCATION);
    if (hasLoc) await Location.stopLocationUpdatesAsync(TASK_NAMES.LOCATION);
}
```

ADAPTIVE_POLLING 쿨다운 스킵 시 경로 수집:
```typescript
if (currentServicePhase === 'ADAPTIVE_POLLING') {
    const now = Date.now();
    const distance = store.distanceToTarget ?? Infinity;
    const speed = store.speed ?? 0;
    const cooldown = calculateDynamicCooldown(distance, speed);

    if (now - lastProcessedAt < cooldown) {
        // 쿨다운 스킵이지만 경로 수집은 수행
        if (store.isTracking) {
            store.addRoutePoint({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: location.timestamp || Date.now(),
            });
        }
        return;
    }
    lastProcessedAt = now;
}
```

### 4. trackingConfig.ts — GEOFENCING 경로 수집 설정

```typescript
/** GEOFENCING phase route collection (low-power) */
export const GEOFENCING_ROUTE_CONFIG = {
    DISTANCE_INTERVAL: 200,  // meters
    TIME_INTERVAL: 60_000,   // 60 seconds
} as const;
```

### 5. schema.ts — DB 스키마 확장

Alarm 인터페이스에 추가:
```typescript
route_points: string | null;       // JSON: RoutePoint[]
traveled_distance: number | null;  // meters
cancelled_at: string | null;
```

### 6. database.ts — 마이그레이션

```typescript
const newColumns = [
    // 기존 마이그레이션...
    'ALTER TABLE alarms ADD COLUMN route_points TEXT',
    'ALTER TABLE alarms ADD COLUMN traveled_distance REAL',
    'ALTER TABLE alarms ADD COLUMN cancelled_at TEXT',
];
```

updateAlarm에 새 필드 지원:
```typescript
if (updates.route_points !== undefined) { fields.push('route_points = ?'); values.push(updates.route_points); }
if (updates.traveled_distance !== undefined) { fields.push('traveled_distance = ?'); values.push(updates.traveled_distance); }
if (updates.cancelled_at !== undefined) { fields.push('cancelled_at = ?'); values.push(updates.cancelled_at); }
```

### 7. alarmStore.ts — 완료/취소 시 경로 저장

```typescript
completeAlarm: async (id) => {
    try {
        set({ dismissedAlarmId: id });
        const locationStore = useLocationStore.getState();
        const routePoints = locationStore.routeHistory;
        const traveledDistance = locationStore.traveledDistance;

        await db.updateAlarm(id, {
            is_active: false,
            arrived_at: new Date().toISOString(),
            route_points: routePoints.length > 0 ? JSON.stringify(routePoints) : null,
            traveled_distance: traveledDistance > 0 ? traveledDistance : null,
        });
        await get().loadAlarms();
        await get().loadActiveAlarm();
    } catch (error) {
        set({ error: (error as Error).message });
    }
},

deactivateAlarm: async (id) => {
    try {
        const locationStore = useLocationStore.getState();
        const routePoints = locationStore.routeHistory;
        const traveledDistance = locationStore.traveledDistance;

        await db.updateAlarm(id, {
            is_active: false,
            cancelled_at: new Date().toISOString(),
            route_points: routePoints.length > 0 ? JSON.stringify(routePoints) : null,
            traveled_distance: traveledDistance > 0 ? traveledDistance : null,
        });
        await get().loadAlarms();
        await get().loadActiveAlarm();
    } catch (error) {
        set({ error: (error as Error).message });
    }
},
```

### 8. alarm-detail.tsx — 경로 폴리라인 + 취소시간 + 실제 이동거리

- `route_points` JSON 파싱하여 Polyline 렌더링 (녹색)
- `cancelled_at` 표시 (arrived가 아닌 경우)
- `traveled_distance`가 있으면 실제 이동거리, 없으면 직선거리
- mapRegion을 route_points 기반으로 fitToCoordinates

### 9. i18n 번역 추가

```json
// ko.json
"cancelledAt": "취소 시간",
"actualDistance": "실제 이동 거리"

// en.json
"cancelledAt": "Cancelled at",
"actualDistance": "Actual distance traveled"

// ja.json
"cancelledAt": "キャンセル時刻",
"actualDistance": "実際の移動距離"
```

---

## 검증 방법

1. 알람 설정 → 취소 → 알림 사라지는지 확인
2. 원거리 알람 → GEOFENCING 단계에서도 경로 수집되는지 확인
3. 알람 완료 후 히스토리 → 녹색 폴리라인 표시 확인
4. 알람 취소 후 히스토리 → 취소시간 + 경로 표시 확인
5. 이동거리가 직선이 아닌 실제 거리로 표시 확인

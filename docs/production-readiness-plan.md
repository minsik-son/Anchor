# LocaAlert 프로덕션 레디니스 개선 플랜

**작성일:** 2026-02-18
**프로젝트:** LocaAlert (위치 기반 알람 앱)
**현재 스택:** React Native (Expo 54) / TypeScript / SQLite / Zustand
**목표:** 토스급 프로덕션 앱 수준의 안정성, 성능, 품질 확보

---

## 목차

1. [크래시 리포팅 (Sentry)](#1-크래시-리포팅-sentry)
2. [백그라운드 크래시 복구 + 경로 중간 저장](#2-백그라운드-크래시-복구--경로-중간-저장)
3. [성능 최적화](#3-성능-최적화)
4. [유닛 테스트](#4-유닛-테스트)
5. [모니터링 / 관측 가능성](#5-모니터링--관측-가능성-observability)
6. [접근성 (Accessibility)](#6-접근성-accessibility)
7. [네트워크 오프라인 처리](#7-네트워크-오프라인-처리)
8. [DB 마이그레이션 시스템](#8-db-마이그레이션-시스템)
9. [개인정보 보호 / 보안](#9-개인정보-보호--보안)
10. [CI/CD 파이프라인](#10-cicd-파이프라인)

---

## 1. 크래시 리포팅 (Sentry)

### 왜 필요한가

현재 프로젝트의 에러 처리 패턴:

```typescript
// 현재 — 15개 파일에서 이 패턴 반복
try {
    await someOperation();
} catch (error) {
    console.warn('[ModuleName] Something failed:', error);
}
```

`console.warn`과 `console.error`는 개발 중 Xcode/Metro 콘솔에서만 보인다. 실제 사용자 기기에서 앱이 크래시하면 원인을 알 방법이 전혀 없다. "알람이 안 울려요"라는 리뷰가 오면 재현도 불가능하다.

### 무엇이 필요한가

**필수 패키지:** `@sentry/react-native`
**서비스:** Sentry (무료 플랜: 월 5,000 이벤트)
**로그인:** Sentry 계정 생성 (sentry.io) → 프로젝트 생성 → DSN 발급

### 어떻게 구현하는가

**Step 1: 설치**
```bash
npx expo install @sentry/react-native
```

**Step 2: app.json 플러그인 추가**
```json
{
  "plugins": [
    ["@sentry/react-native/expo", {
      "organization": "locaalert",
      "project": "locaalert-mobile"
    }]
  ]
}
```

**Step 3: 앱 진입점 초기화 (`app/_layout.tsx`)**
```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
    dsn: 'https://xxx@sentry.io/xxx',
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.2,  // 20% 성능 트레이싱
    beforeSend(event) {
        // 개발 환경에서는 전송하지 않음
        if (__DEV__) return null;
        return event;
    },
});
```

**Step 4: 기존 에러 핸들링에 Sentry 연동**

현재 try-catch 패턴을 감싸는 유틸리티 함수 생성:

```typescript
// src/utils/errorReporting.ts
import * as Sentry from '@sentry/react-native';

export function captureError(error: unknown, context?: Record<string, any>) {
    console.error(error);
    Sentry.captureException(error, {
        extra: context,
    });
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'warning') {
    Sentry.captureMessage(message, level);
}

export function setUserContext(userId: string) {
    Sentry.setUser({ id: userId });
}
```

**Step 5: 중요 서비스에 적용 (예: locationService.ts)**
```typescript
// Before
catch (err) {
    console.warn('[LocationService] Geofencing failed:', err);
}

// After
catch (err) {
    captureError(err, {
        module: 'LocationService',
        action: 'setupGeofencing',
        target: currentTarget,
        phase: currentServicePhase,
    });
}
```

**Step 6: 네비게이션 추적 (Breadcrumbs)**
```typescript
// 사용자가 어떤 화면을 거쳤는지 자동 추적
export default Sentry.wrap(function RootLayout() {
    // ...기존 _layout.tsx 내용
});
```

### 최적 구현 방식

모든 console.warn/error를 한 번에 바꾸지 않는다. 우선순위 기준으로 단계적 적용:

1단계 — 치명적 경로: `locationService.ts`, `notificationService.ts`, `database.ts`
2단계 — 핵심 기능: `alarmStore.ts`, `locationStore.ts`
3단계 — 나머지: 검색, 챌린지, 활동 등

### 기대 효과

Sentry 대시보드에서 확인 가능한 정보:
- 크래시율 (세션 대비 크래시 비율)
- 영향받은 사용자 수
- 기기 모델, OS 버전, 메모리 상태
- 크래시 직전 사용자 행동 경로 (Breadcrumbs)
- 스택트레이스 (정확한 코드 위치)

---

## 2. 백그라운드 크래시 복구 + 경로 중간 저장

### 왜 필요한가

현재 `routeHistory`는 Zustand 인메모리 상태에만 존재한다:

```typescript
// locationStore.ts — 앱이 죽으면 이 데이터가 전부 사라짐
routeHistory: [] as RoutePoint[],
traveledDistance: 0,
```

시나리오: 사용자가 서울→부산 3시간 추적 중 → iOS가 메모리 부족으로 백그라운드 앱 kill → 앱 재실행 시 routeHistory = [] (3시간치 데이터 소실)

### 무엇이 필요한가

**필수 패키지:** 이미 설치된 `expo-sqlite`, `@react-native-async-storage/async-storage`
**추가 패키지:** 없음 (기존 인프라 활용)
**로그인 필요:** 없음

### 어떻게 구현하는가

**핵심 전략: Checkpoint 시스템**

일정 간격으로 routeHistory를 SQLite에 중간 저장하고, 앱 재시작 시 복원한다.

**Step 1: DB 스키마에 tracking_sessions 테이블 추가**

```sql
CREATE TABLE IF NOT EXISTS tracking_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alarm_id INTEGER NOT NULL,
    route_points TEXT NOT NULL,        -- JSON: RoutePoint[]
    traveled_distance REAL DEFAULT 0,
    last_checkpoint_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (alarm_id) REFERENCES alarms(id) ON DELETE CASCADE
);
```

**Step 2: Checkpoint 서비스 생성**

```typescript
// src/services/checkpoint/checkpointService.ts
const CHECKPOINT_INTERVAL = 50;  // 50포인트마다 저장
const CHECKPOINT_TIME_MS = 5 * 60 * 1000;  // 또는 5분마다

let lastCheckpointCount = 0;
let lastCheckpointTime = Date.now();

export async function maybeCheckpoint(
    alarmId: number,
    routeHistory: RoutePoint[],
    traveledDistance: number,
): Promise<void> {
    const now = Date.now();
    const pointsSinceLastCheckpoint = routeHistory.length - lastCheckpointCount;
    const timeSinceLastCheckpoint = now - lastCheckpointTime;

    if (pointsSinceLastCheckpoint >= CHECKPOINT_INTERVAL ||
        timeSinceLastCheckpoint >= CHECKPOINT_TIME_MS) {

        await db.upsertTrackingSession({
            alarm_id: alarmId,
            route_points: JSON.stringify(routeHistory),
            traveled_distance: traveledDistance,
            last_checkpoint_at: new Date().toISOString(),
            is_active: true,
        });

        lastCheckpointCount = routeHistory.length;
        lastCheckpointTime = now;
    }
}
```

**Step 3: locationService.ts의 addRoutePoint 후에 checkpoint 호출**

```typescript
// LOCATION 태스크 안에서
if (store.isTracking) {
    store.addRoutePoint({ ... });

    const alarmStore = useAlarmStore.getState();
    if (alarmStore.activeAlarm) {
        maybeCheckpoint(
            alarmStore.activeAlarm.id,
            store.routeHistory,
            store.traveledDistance,
        ).catch(() => {});  // 체크포인트 실패가 추적을 멈추면 안 됨
    }
}
```

**Step 4: 앱 시작 시 복원 로직 (`_layout.tsx`)**

```typescript
// 앱 초기화 시
const activeSession = await db.getActiveTrackingSession();
if (activeSession) {
    const routePoints = JSON.parse(activeSession.route_points);
    const locationStore = useLocationStore.getState();
    locationStore.restoreRouteHistory(routePoints, activeSession.traveled_distance);
    console.log(`[Recovery] Restored ${routePoints.length} route points`);
}
```

**Step 5: 추적 종료 시 세션 정리**

```typescript
// stopAllTracking에서
await db.deactivateTrackingSession(alarmId);
```

### 최적 구현 방식

체크포인트는 비동기로 수행하되, 실패해도 추적이 멈추지 않아야 한다 (fire-and-forget 패턴). SQLite의 WAL 모드가 이미 활성화되어 있으므로 쓰기 성능은 충분하다.

JSON 직렬화 비용을 줄이기 위해, 마지막 체크포인트 이후의 새 포인트만 append하는 방식도 고려할 수 있지만, MVP에서는 전체 저장이 더 안전하다.

---

## 3. 성능 최적화

### 왜 필요한가

**문제 A: 배열 복사 (O(n) 매번)**
```typescript
// locationStore.ts — 포인트 5000개일 때 매번 5000개 복사
set({
    routeHistory: [...routeHistory, point],  // O(n) 복사
    traveledDistance: newDistance,
});
```

React Native의 JavaScript 엔진(Hermes)에서 큰 배열을 반복 복사하면 GC(Garbage Collection) 압박이 커지고, GC가 돌 때 UI 프레임이 끊긴다 (jank).

**문제 B: 히스토리 전체 로드**
```typescript
// alarmStore.ts — 알람 수백 개 시 전체 로드
const alarms = await db.getAllAlarms();
```

**문제 C: SQLite 인덱스 부재**

현재 5개 테이블에 PRIMARY KEY 외 인덱스가 없다. `WHERE is_active = 1`이나 `ORDER BY created_at DESC` 같은 쿼리가 테이블 풀스캔을 한다.

### 무엇이 필요한가

**필수 패키지:** 없음 (코드 레벨 최적화)
**로그인 필요:** 없음

### 어떻게 구현하는가

**A. 배열 복사 최적화 — Mutable Array + Shallow Update**

```typescript
// locationStore.ts 수정
// 방법 1: mutable 배열 사용 + 개수만 상태로 관리
interface LocationState {
    _routeHistory: RoutePoint[];  // mutable, 상태 트리거 안 함
    routePointCount: number;       // 이 값의 변경으로 리렌더 트리거
    traveledDistance: number;
}

addRoutePoint: (point) => {
    const state = get();
    state._routeHistory.push(point);  // O(1) push, 복사 없음

    let newDistance = state.traveledDistance;
    if (state._routeHistory.length > 1) {
        const prev = state._routeHistory[state._routeHistory.length - 2];
        newDistance += calculateDistance(
            { latitude: prev.latitude, longitude: prev.longitude },
            { latitude: point.latitude, longitude: point.longitude }
        );
    }
    set({
        routePointCount: state._routeHistory.length,
        traveledDistance: newDistance,
    });
},

// 컴포넌트에서 접근 시
get routeHistory() {
    return get()._routeHistory;
}
```

**B. 히스토리 페이지네이션**

```typescript
// database.ts
export async function getAlarmsPaginated(
    offset: number = 0,
    limit: number = 20,
): Promise<Alarm[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<Alarm>(
        'SELECT * FROM alarms ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
    );
    return rows.map(row => ({ ...row, is_active: Boolean(row.is_active) }));
}
```

```typescript
// history.tsx에서 FlatList의 onEndReached로 추가 로드
const [page, setPage] = useState(0);
const loadMore = async () => {
    const more = await db.getAlarmsPaginated((page + 1) * 20, 20);
    if (more.length > 0) {
        setAlarms(prev => [...prev, ...more]);
        setPage(p => p + 1);
    }
};
```

**C. SQLite 인덱스 추가**

```typescript
// database.ts — runMigrations에 추가
const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_alarms_is_active ON alarms(is_active)',
    'CREATE INDEX IF NOT EXISTS idx_alarms_created_at ON alarms(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_alarms_arrived_at ON alarms(arrived_at)',
    'CREATE INDEX IF NOT EXISTS idx_action_memos_alarm_id ON action_memos(alarm_id)',
    'CREATE INDEX IF NOT EXISTS idx_visit_records_challenge_id ON visit_records(challenge_id)',
    'CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status)',
];
for (const sql of indexes) {
    try {
        await database.runAsync(sql);
    } catch (e: any) {
        console.warn('[DB Index]', e.message);
    }
}
```

### 최적 구현 방식

배열 최적화는 `_routeHistory`를 mutable로 유지하되, Zustand의 `routePointCount` 변경으로 구독 컴포넌트 리렌더를 트리거하는 방식이 가장 실용적이다. Immer를 쓸 수도 있지만 추가 의존성이 생기고, 위치 추적처럼 고빈도 업데이트에서는 Immer의 프록시 오버헤드도 무시 못 한다.

인덱스는 `CREATE INDEX IF NOT EXISTS`로 안전하게 추가하므로 기존 데이터에 영향이 없다.

---

## 4. 유닛 테스트

### 왜 필요한가

현재 테스트 파일이 0개이고, 테스트 프레임워크도 설치되어 있지 않다.

3-Phase 추적 시스템은 복잡한 상태 전환 로직이 있다. 쿨다운 계산, 위상 전환, 거리 계산 등을 수정할 때마다 실기기에서 직접 걸어다니며 테스트하는 것은 비현실적이고, 사이드 이펙트를 놓치기 쉽다.

### 무엇이 필요한가

**필수 패키지:**
```bash
npx expo install jest-expo @types/jest ts-jest
npm install --save-dev @testing-library/react-native @testing-library/jest-native
```

**로그인 필요:** 없음

### 어떻게 테스트하는가 — 구체적 테스트 케이스

**A. 순수 함수 테스트 (가장 쉬움, 가장 먼저)**

```typescript
// __tests__/trackingConfig.test.ts
import { calculateDynamicCooldown, shouldEnterActiveTracking, determinePhase } from '../src/services/location/locationService';

describe('calculateDynamicCooldown', () => {
    test('가까운 거리(2km) + 빠른 속도(80km/h)일 때 짧은 쿨다운', () => {
        const cooldown = calculateDynamicCooldown(2000, 80);
        expect(cooldown).toBeGreaterThanOrEqual(10_000);  // MIN
        expect(cooldown).toBeLessThanOrEqual(30_000);      // MAX
    });

    test('먼 거리(60km)일 때 장거리 쿨다운 적용', () => {
        const cooldown = calculateDynamicCooldown(60_000, 30);
        expect(cooldown).toBeLessThanOrEqual(300_000);  // LONG_RANGE_MAX
    });

    test('정지 상태(0km/h)에서 최소 속도 가정', () => {
        const cooldown = calculateDynamicCooldown(3000, 0);
        expect(cooldown).toBeGreaterThan(0);
    });
});

describe('determinePhase', () => {
    test('5km 이상이면 GEOFENCING', () => {
        expect(determinePhase(6000, 0, 'IDLE')).toBe('GEOFENCING');
    });

    test('1.5km ~ 5km이면 ADAPTIVE_POLLING', () => {
        expect(determinePhase(3000, 30, 'GEOFENCING')).toBe('ADAPTIVE_POLLING');
    });

    test('1.5km 미만이면 ACTIVE_TRACKING', () => {
        expect(determinePhase(1000, 30, 'ADAPTIVE_POLLING')).toBe('ACTIVE_TRACKING');
    });

    test('ACTIVE_TRACKING에서 2km 이하면 유지 (히스테리시스)', () => {
        expect(determinePhase(1800, 30, 'ACTIVE_TRACKING')).toBe('ACTIVE_TRACKING');
    });

    test('ACTIVE_TRACKING에서 2km 초과하면 ADAPTIVE_POLLING 전환', () => {
        expect(determinePhase(2500, 30, 'ACTIVE_TRACKING')).toBe('ADAPTIVE_POLLING');
    });

    test('ETA 3분 미만이면 거리 상관없이 ACTIVE_TRACKING', () => {
        // 4km인데 120km/h로 달리면 ETA = 2분
        expect(determinePhase(4000, 120, 'ADAPTIVE_POLLING')).toBe('ACTIVE_TRACKING');
    });
});
```

**B. 거리 계산 테스트**

```typescript
// __tests__/geofence.test.ts
import { calculateDistance, isWithinRadius } from '../src/services/location/geofence';

describe('calculateDistance (Haversine)', () => {
    test('같은 좌표면 거리 0', () => {
        const d = calculateDistance(
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.5665, longitude: 126.9780 }
        );
        expect(d).toBe(0);
    });

    test('서울시청 → 강남역 약 8.9km', () => {
        const d = calculateDistance(
            { latitude: 37.5665, longitude: 126.9780 },  // 서울시청
            { latitude: 37.4979, longitude: 127.0276 }   // 강남역
        );
        expect(d).toBeGreaterThan(8000);
        expect(d).toBeLessThan(10000);
    });

    test('서울 → 부산 약 325km', () => {
        const d = calculateDistance(
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 35.1796, longitude: 129.0756 }
        );
        expect(d).toBeGreaterThan(300_000);
        expect(d).toBeLessThan(350_000);
    });
});

describe('isWithinRadius', () => {
    test('반경 500m 내에 있으면 true', () => {
        expect(isWithinRadius(
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.5665, longitude: 126.9785 },
            500
        )).toBe(true);
    });

    test('반경 500m 밖이면 false', () => {
        expect(isWithinRadius(
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.5700, longitude: 126.9850 },
            500
        )).toBe(false);
    });
});
```

**C. Store 로직 테스트**

```typescript
// __tests__/locationStore.test.ts
import { useLocationStore } from '../src/stores/locationStore';

describe('locationStore.addRoutePoint', () => {
    beforeEach(() => {
        useLocationStore.getState().clearRouteHistory();
    });

    test('첫 포인트 추가 시 거리 0', () => {
        useLocationStore.getState().addRoutePoint({
            latitude: 37.5665, longitude: 126.9780, timestamp: Date.now()
        });
        expect(useLocationStore.getState().traveledDistance).toBe(0);
        expect(useLocationStore.getState().routeHistory).toHaveLength(1);
    });

    test('두 번째 포인트 추가 시 거리 누적', () => {
        const store = useLocationStore.getState();
        store.addRoutePoint({ latitude: 37.5665, longitude: 126.9780, timestamp: Date.now() });
        store.addRoutePoint({ latitude: 37.5670, longitude: 126.9785, timestamp: Date.now() });

        expect(useLocationStore.getState().traveledDistance).toBeGreaterThan(0);
        expect(useLocationStore.getState().routeHistory).toHaveLength(2);
    });

    test('clearRouteHistory하면 초기화', () => {
        const store = useLocationStore.getState();
        store.addRoutePoint({ latitude: 37.5665, longitude: 126.9780, timestamp: Date.now() });
        store.clearRouteHistory();

        expect(useLocationStore.getState().traveledDistance).toBe(0);
        expect(useLocationStore.getState().routeHistory).toHaveLength(0);
    });
});
```

**D. 알림 서비스 테스트 (Mocking)**

```typescript
// __tests__/notificationService.test.ts
jest.mock('expo-notifications');

import * as Notifications from 'expo-notifications';
import { sendTrackingNotification, clearTrackingNotification } from '../src/services/notification/notificationService';

describe('sendTrackingNotification', () => {
    test('거리 포맷: 1km 미만이면 m 단위', async () => {
        await sendTrackingNotification(590, 120, 1, '강남역');

        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.objectContaining({
                    title: expect.stringContaining('590m'),
                }),
            })
        );
    });

    test('거리 포맷: 1km 이상이면 km 단위', async () => {
        await sendTrackingNotification(2500, 300, 1, '부산역');

        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.objectContaining({
                    title: expect.stringContaining('2.5km'),
                }),
            })
        );
    });
});
```

### 설정 방법

**package.json 추가:**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
    ],
    "setupFilesAfterSetup": ["@testing-library/jest-native/extend-expect"]
  }
}
```

### 최적 구현 방식

테스트를 한 번에 전부 작성하려 하지 않는다. 우선순위:

1단계: 순수 함수 (calculateDistance, calculateDynamicCooldown, determinePhase, formatDistance)
2단계: Store 로직 (addRoutePoint, checkGeofence, completeAlarm)
3단계: 서비스 레이어 (notificationService mock 테스트)
4단계: 컴포넌트 (스냅샷 테스트)

순수 함수부터 시작하면 mock 없이 바로 테스트 가능하고, 커버리지가 빠르게 올라간다. 현재 `calculateDynamicCooldown`과 `determinePhase`는 `locationService.ts` 안에 있어서 export 되지 않는다. 이 함수들을 별도 유틸리티 파일로 추출하면 테스트가 쉬워진다:

```
src/services/location/phaseCalculator.ts  ← 순수 함수들
src/services/location/locationService.ts  ← 서비스 (phaseCalculator import)
```

---

## 5. 모니터링 / 관측 가능성 (Observability)

### 왜 필요한가

크래시 리포팅(Sentry)은 앱이 "죽었을 때" 알려준다. 모니터링은 앱이 "정상 작동하면서도 사용자가 문제를 겪을 때" 원인을 분석하는 도구이다.

예: "폴리라인이 끊겨요" → Sentry에는 크래시가 안 잡힘 → 하지만 GEOFENCING 단계에서 경로 수집이 안 되고 있었음 → 모니터링이 있었다면 "이 세션에서 GEOFENCING 10분 동안 경로 포인트 0개"라는 데이터로 원인 파악 가능.

### 무엇이 필요한가

**2가지 선택지:**

| 방식 | 도구 | 비용 | 장점 | 단점 |
|------|------|------|------|------|
| A. 외부 서비스 | Mixpanel / Amplitude | 무료 플랜 있음 | 대시보드 제공, 실시간 | 데이터가 외부로 나감 |
| B. 로컬 로그 | SQLite + Export | 무료 | 데이터 통제 가능 | 직접 분석해야 함 |

**추천: B (로컬 로그) → 추후 A로 확장**

로그인 필요: 없음 (방식 B의 경우)

### 어떻게 구현하는가

**Step 1: 텔레메트리 테이블 생성**

```sql
CREATE TABLE IF NOT EXISTS telemetry_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,     -- 추적 세션별 고유 ID
    event_type TEXT NOT NULL,     -- 'phase_transition', 'route_point', 'alarm_trigger' 등
    event_data TEXT,              -- JSON: 이벤트별 상세 데이터
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_logs(event_type);
```

**Step 2: 텔레메트리 서비스**

```typescript
// src/services/telemetry/telemetryService.ts
let currentSessionId: string | null = null;

export function startSession(): string {
    currentSessionId = `session_${Date.now()}`;
    return currentSessionId;
}

export async function logEvent(
    eventType: string,
    data?: Record<string, any>,
): Promise<void> {
    if (!currentSessionId) return;
    try {
        await db.insertTelemetryLog({
            session_id: currentSessionId,
            event_type: eventType,
            event_data: data ? JSON.stringify(data) : null,
        });
    } catch {
        // 텔레메트리 실패가 앱을 멈추면 안 됨
    }
}

export function endSession(): void {
    currentSessionId = null;
}
```

**Step 3: 핵심 이벤트 수집 (locationService.ts에 추가)**

```typescript
// 위상 전환 시
logEvent('phase_transition', {
    from: prev,
    to: newPhase,
    distance: store.distanceToTarget,
    speed: store.speed,
});

// 경로 포인트 수집 시 (매번이 아니라 100포인트마다)
if (store.routeHistory.length % 100 === 0) {
    logEvent('route_milestone', {
        totalPoints: store.routeHistory.length,
        traveledDistance: store.traveledDistance,
        accuracy: location.coords.accuracy,
    });
}

// 알람 트리거 시
logEvent('alarm_triggered', {
    distance: store.distanceToTarget,
    totalPoints: store.routeHistory.length,
    traveledDistance: store.traveledDistance,
    trackingDurationMs: Date.now() - trackingStartTime,
});
```

**Step 4: 디버그 화면에서 로그 Export (`dev-debug.tsx`)**

```typescript
const exportLogs = async () => {
    const logs = await db.getTelemetryLogs(currentSessionId);
    const json = JSON.stringify(logs, null, 2);
    await Sharing.shareAsync(fileUri);  // 파일로 공유
};
```

### 최적 구현 방식

로그 양이 무한히 늘어나지 않도록 보존 정책 필요:
- 30일 이상 된 로그 자동 삭제
- 테이블 크기 상한 (예: 10,000행) 초과 시 오래된 것부터 삭제
- 릴리스 빌드에서는 샘플링 적용 (모든 이벤트의 10%만 저장)

---

## 6. 접근성 (Accessibility)

### 왜 필요한가

현재 코드베이스에 `accessibilityLabel`, `accessibilityRole` 속성이 단 하나도 없다. VoiceOver(iOS)나 TalkBack(Android)을 켜면 "버튼", "이미지" 같은 의미 없는 라벨만 읽히거나 아예 읽히지 않는다.

한국 장애인차별금지법에 따라 모바일 앱 접근성 준수가 점차 의무화되고 있고, 앱스토어 리뷰에서도 접근성이 점점 중요한 기준이 되고 있다.

### 무엇이 필요한가

**필수 패키지:** 없음 (React Native 내장 접근성 API 사용)
**로그인 필요:** 없음

### 어떻게 구현하는가

**우선순위 기준: 인터랙티브 요소 → 정보 표시 요소 → 장식 요소**

**A. 버튼/터치 요소**

```typescript
// Before
<Pressable onPress={handleCancelAlarm}>
    <Ionicons name="close" size={24} />
</Pressable>

// After
<Pressable
    onPress={handleCancelAlarm}
    accessibilityRole="button"
    accessibilityLabel={t('alarmDashboard.cancelAlarm')}
    accessibilityHint={t('accessibility.cancelAlarmHint')}
>
    <Ionicons name="close" size={24} />
</Pressable>
```

**B. 지도 영역**

```typescript
<MapView
    accessible={true}
    accessibilityLabel={t('accessibility.mapShowingDestination', {
        destination: alarm?.title
    })}
    accessibilityElementsHidden={false}
>
```

**C. 상태 정보**

```typescript
// 대시보드의 거리/시간 표시
<Text
    accessibilityRole="text"
    accessibilityLabel={t('accessibility.remainingDistance', {
        distance: distanceStr
    })}
>
    {distanceStr}
</Text>
```

**D. 색상 대비 검증**

현재 테마 색상이 WCAG 2.1 AA 기준(4.5:1 이상)을 만족하는지 확인 필요. 특히:
- `textWeak` (연한 회색) 위의 텍스트
- `primary` (파란색) 배경 위의 흰색 텍스트
- 다크 모드에서의 대비

### 최적 구현 방식

한 번에 전체를 하려 하지 않고, 핵심 사용 흐름(Critical Path) 순서대로:

1단계: 알람 설정 흐름 (검색 → 설정 → 확인)
2단계: 알람 트리거 화면 (슬라이더 dismiss)
3단계: 히스토리/상세
4단계: 설정, 챌린지 등 부가 기능

---

## 7. 네트워크 오프라인 처리

### 왜 필요한가

현재 오프라인 감지 코드가 없다. 지하철, 터널, 비행기 모드 등에서:
- 역지오코딩(`reverseGeocode`) 실패 → 주소 빈 화면
- 검색 API 호출 실패 → 빈 결과 또는 에러
- 지도 타일 로딩 실패 → 흰 화면

위치 추적 자체는 GPS 기반이라 오프라인에서도 동작하지만, UI가 깨진다.

### 무엇이 필요한가

**필수 패키지:**
```bash
npx expo install @react-native-community/netinfo
```

**로그인 필요:** 없음

### 어떻게 구현하는가

**Step 1: 네트워크 상태 감지 Hook**

```typescript
// src/hooks/useNetworkStatus.ts
import NetInfo from '@react-native-community/netinfo';
import { useState, useEffect } from 'react';

export function useNetworkStatus() {
    const [isConnected, setIsConnected] = useState(true);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected ?? true);
        });
        return unsubscribe;
    }, []);

    return { isConnected };
}
```

**Step 2: 오프라인 배너 컴포넌트**

```typescript
// src/components/common/OfflineBanner.tsx
export function OfflineBanner() {
    const { isConnected } = useNetworkStatus();
    if (isConnected) return null;

    return (
        <View style={styles.banner}>
            <Ionicons name="cloud-offline-outline" size={16} color="#FFF" />
            <Text style={styles.bannerText}>
                {t('common.offlineMode')}
            </Text>
        </View>
    );
}
```

**Step 3: 역지오코딩 캐시 강화**

현재 `geocoding.ts`에 메모리 캐시가 있지만, 앱 재시작 시 사라진다. AsyncStorage 기반 영구 캐시로 업그레이드:

```typescript
// 오프라인에서도 이전에 조회한 주소는 표시 가능
const GEOCODE_CACHE_KEY = '@locaalert:geocode_cache';
const MAX_CACHE_ENTRIES = 200;

export async function reverseGeocodeWithPersistentCache(
    lat: number, lng: number
): Promise<GeoResult> {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

    // 1. 메모리 캐시 확인
    if (memoryCache.has(key)) return memoryCache.get(key)!;

    // 2. 영구 캐시 확인
    const stored = await AsyncStorage.getItem(GEOCODE_CACHE_KEY);
    const cache = stored ? JSON.parse(stored) : {};
    if (cache[key]) {
        memoryCache.set(key, cache[key]);
        return cache[key];
    }

    // 3. 네트워크 요청 (오프라인이면 폴백)
    try {
        const result = await reverseGeocode(lat, lng);
        cache[key] = result;
        memoryCache.set(key, result);
        await AsyncStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
        return result;
    } catch {
        return { address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    }
}
```

**Step 4: 검색에서 오프라인 처리**

```typescript
// searchService.ts
export async function searchPlaces(query: string): Promise<SearchResult[]> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
        // 오프라인: 최근 검색 기록이나 즐겨찾기에서 매칭
        return searchFromLocalCache(query);
    }
    // ... 기존 온라인 검색 로직
}
```

### 최적 구현 방식

오프라인 처리의 핵심 원칙은 "기능이 100% 작동하지 않더라도, 앱이 에러를 내거나 빈 화면을 보여주지 않는 것"이다. 위치 추적은 GPS로 계속 동작하고, UI만 graceful하게 폴백한다.

---

## 8. DB 마이그레이션 시스템

### 왜 필요한가

현재 마이그레이션 방식:

```typescript
// "duplicate column" 에러를 무시하는 방식
const newColumns = [
    'ALTER TABLE alarms ADD COLUMN started_at TEXT',
    'ALTER TABLE alarms ADD COLUMN route_points TEXT',
    // ...
];
for (const sql of newColumns) {
    try { await database.runAsync(sql); }
    catch (e: any) {
        if (!e.message?.includes('duplicate column')) {
            console.warn('[DB Migration]', e.message);
        }
    }
}
```

컬럼 추가만 할 때는 작동하지만, 다음 상황에서는 불가능하다:
- 컬럼 타입 변경 (SQLite는 ALTER COLUMN 지원 안 함)
- 테이블 분리/합치기
- 데이터 변환 (예: 기존 JSON 구조 변경)
- 컬럼 삭제 (SQLite는 DROP COLUMN 미지원 — SQLite 3.35 미만)

### 무엇이 필요한가

**필수 패키지:** 없음 (SQLite의 `user_version` PRAGMA 활용)
**로그인 필요:** 없음

### 어떻게 구현하는가

**핵심: 버전 번호 기반 마이그레이션**

```typescript
// src/db/migrations.ts
interface Migration {
    version: number;
    description: string;
    up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

const migrations: Migration[] = [
    {
        version: 1,
        description: 'Add tracking columns to alarms',
        up: async (db) => {
            await db.runAsync('ALTER TABLE alarms ADD COLUMN started_at TEXT');
            await db.runAsync('ALTER TABLE alarms ADD COLUMN arrived_at TEXT');
            await db.runAsync('ALTER TABLE alarms ADD COLUMN start_latitude REAL');
            await db.runAsync('ALTER TABLE alarms ADD COLUMN start_longitude REAL');
        },
    },
    {
        version: 2,
        description: 'Add route history and cancellation to alarms',
        up: async (db) => {
            await db.runAsync('ALTER TABLE alarms ADD COLUMN route_points TEXT');
            await db.runAsync('ALTER TABLE alarms ADD COLUMN traveled_distance REAL');
            await db.runAsync('ALTER TABLE alarms ADD COLUMN cancelled_at TEXT');
        },
    },
    {
        version: 3,
        description: 'Add database indexes for performance',
        up: async (db) => {
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_alarms_is_active ON alarms(is_active)');
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_alarms_created_at ON alarms(created_at DESC)');
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_action_memos_alarm_id ON action_memos(alarm_id)');
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_visit_records_challenge ON visit_records(challenge_id)');
        },
    },
    {
        version: 4,
        description: 'Add tracking sessions for crash recovery',
        up: async (db) => {
            await db.runAsync(`
                CREATE TABLE IF NOT EXISTS tracking_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    alarm_id INTEGER NOT NULL,
                    route_points TEXT NOT NULL,
                    traveled_distance REAL DEFAULT 0,
                    last_checkpoint_at TEXT NOT NULL,
                    is_active INTEGER DEFAULT 1,
                    FOREIGN KEY (alarm_id) REFERENCES alarms(id) ON DELETE CASCADE
                )
            `);
        },
    },
    {
        version: 5,
        description: 'Add telemetry logs table',
        up: async (db) => {
            await db.runAsync(`
                CREATE TABLE IF NOT EXISTS telemetry_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    event_data TEXT,
                    created_at TEXT DEFAULT (datetime('now', 'localtime'))
                )
            `);
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_logs(session_id)');
        },
    },
];

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
    // 현재 DB 버전 확인
    const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const currentVersion = result?.user_version ?? 0;

    // 필요한 마이그레이션만 실행
    const pending = migrations.filter(m => m.version > currentVersion);

    for (const migration of pending) {
        console.log(`[DB Migration] Running v${migration.version}: ${migration.description}`);
        try {
            await migration.up(db);
            await db.runAsync(`PRAGMA user_version = ${migration.version}`);
        } catch (error) {
            console.error(`[DB Migration] Failed at v${migration.version}:`, error);
            throw error;  // 마이그레이션 실패는 앱 시작을 막아야 함
        }
    }

    if (pending.length > 0) {
        console.log(`[DB Migration] Completed. DB version: ${migrations[migrations.length - 1].version}`);
    }
}
```

### 최적 구현 방식

마이그레이션은 순서가 보장되어야 하고, 중간에 실패하면 그 이후 마이그레이션은 실행하지 않아야 한다. `PRAGMA user_version`은 SQLite에 내장된 정수값으로, 별도 테이블 없이 스키마 버전을 추적할 수 있다.

기존 사용자의 DB에는 `user_version = 0`이므로, 첫 실행 시 모든 마이그레이션이 순차 실행된다. 이미 컬럼이 있는 경우(기존 duplicate column 방식으로 추가된)를 위해 v1의 `up`에서 try-catch를 두는 것이 안전하다.

---

## 9. 개인정보 보호 / 보안

### 왜 필요한가

위치 데이터는 개인정보보호법에서 "민감정보"에 해당한다. 현재 route_points(JSON)가 SQLite에 무기한 저장되며, 암호화도 없고, 삭제 정책도 없다.

앱스토어 제출 시 개인정보 처리방침이 필수이고, Apple의 App Privacy 라벨도 작성해야 한다.

### 무엇이 필요한가

**필수 패키지:** 없음 (정책 + 코드 레벨)
**로그인 필요:** 없음
**필요 사항:** 개인정보 처리방침 웹페이지 (GitHub Pages 등 무료 호스팅)

### 어떻게 구현하는가

**A. 데이터 보존 정책**

```typescript
// src/services/privacy/dataRetentionService.ts
const RETENTION_DAYS = 90;  // 90일 보존

export async function cleanExpiredData(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffStr = cutoff.toISOString();

    const database = db.getDatabase();

    // 90일 이상 된 비활성 알람의 경로 데이터 삭제 (알람 자체는 유지)
    await database.runAsync(
        `UPDATE alarms SET route_points = NULL
         WHERE is_active = 0 AND created_at < ?`,
        [cutoffStr]
    );

    // 텔레메트리 로그 삭제
    await database.runAsync(
        'DELETE FROM telemetry_logs WHERE created_at < ?',
        [cutoffStr]
    );

    console.log('[Privacy] Expired data cleaned');
}
```

앱 시작 시 또는 주 1회 실행.

**B. 사용자 데이터 삭제 기능 (설정 화면)**

```typescript
// 설정에 "내 데이터 삭제" 버튼 추가
const handleDeleteAllData = () => {
    Alert.alert(
        '모든 데이터 삭제',
        '알람 기록, 경로 데이터, 즐겨찾기 등 모든 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
        [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                    await db.deleteAllAlarms();
                    await db.deleteAllChallenges();
                    await db.deleteAllTelemetry();
                    await AsyncStorage.clear();
                    // 앱 재시작 안내
                },
            },
        ]
    );
};
```

**C. 개인정보 처리방침**

앱스토어 제출에 필요한 최소 항목:
- 수집하는 정보: 위치 데이터, 기기 정보 (크래시 리포팅 시)
- 수집 목적: 위치 기반 알람 서비스 제공
- 보존 기간: 90일
- 제3자 제공: Sentry (크래시 리포팅), Google Maps (지도)
- 삭제 요청 방법: 앱 내 설정 또는 이메일

**D. Apple App Privacy 라벨**

App Store Connect에서 설정:
- Location: "Used for App Functionality" (Not Linked to User)
- Diagnostics: "Crash Data" (Linked to User — Sentry 사용 시)

### 최적 구현 방식

SQLite 데이터 암호화(`SQLCipher`)는 성능 오버헤드가 있고 설정이 복잡하므로 MVP에서는 생략. 대신 iOS Keychain/Android Keystore에 민감 설정값(API 키 등)을 저장하는 것은 고려할 만하다. 하지만 현재 API 키는 환경 변수(`EXPO_PUBLIC_*`)로 관리되고 있어서, 클라이언트 사이드에 노출되는 것은 구조적 한계이다.

---

## 10. CI/CD 파이프라인

### 왜 필요한가

현재 빌드/배포 프로세스:

1. 개발자 로컬에서 `npx expo start`
2. Xcode에서 수동 빌드
3. 테스트 없이 빌드
4. 앱스토어 수동 업로드

이 방식은 "빌드할 때마다 되는지 안 되는지 모르는" 상태이다. 코드 변경 → 빌드 실패 → 원인 파악에 시간 소모.

### 무엇이 필요한가

**필수 도구:**
- EAS Build (Expo Application Services) — Expo의 클라우드 빌드 서비스
- GitHub Actions — CI/CD 자동화
- 로그인 필요: Expo 계정 (무료 플랜: 월 15회 빌드), GitHub 계정

### 어떻게 구현하는가

**Step 1: EAS 설정**

```bash
npm install -g eas-cli
eas login
eas build:configure
```

**eas.json 생성:**
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "minsik.son@gmail.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID"
      }
    }
  }
}
```

**Step 2: GitHub Actions — PR 체크**

```yaml
# .github/workflows/pr-check.yml
name: PR Check

on:
  pull_request:
    branches: [main]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

**Step 3: GitHub Actions — 프로덕션 빌드**

```yaml
# .github/workflows/build.yml
name: Build & Submit

on:
  push:
    tags: ['v*']

jobs:
  build-ios:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test
      - run: eas build --platform ios --profile production --non-interactive
```

### 최적 구현 방식

EAS 무료 플랜은 월 15회 빌드 제한이 있으므로, PR마다 풀 빌드를 돌리지 않고 TypeScript 체크 + 테스트만 실행한다. 실제 빌드는 태그 push 시에만 트리거한다.

---

## 구현 우선순위 로드맵

| 순서 | 항목 | 예상 기간 | 의존성 |
|------|------|-----------|--------|
| 1 | 유닛 테스트 기반 구축 | 2-3일 | 없음 |
| 2 | 크래시 리포팅 (Sentry) | 1일 | Sentry 계정 |
| 3 | DB 마이그레이션 시스템 | 1일 | 없음 |
| 4 | 성능 최적화 (배열 + 인덱스) | 1-2일 | 테스트 (검증용) |
| 5 | 백그라운드 크래시 복구 | 2-3일 | DB 마이그레이션 |
| 6 | 네트워크 오프라인 처리 | 1-2일 | 없음 |
| 7 | 접근성 (핵심 흐름) | 2-3일 | 없음 |
| 8 | 모니터링/텔레메트리 | 2일 | DB 마이그레이션 |
| 9 | 개인정보 보호 | 1-2일 | 없음 |
| 10 | CI/CD 파이프라인 | 1일 | 테스트, EAS 계정 |

**총 예상 기간: 2-3주 (순차 진행 시)**

1→2→3은 독립적으로 병렬 진행 가능. 4→5→8은 순차적 의존성이 있다.

---

## 현재 프로젝트 상태 요약

| 항목 | 현재 상태 | 목표 |
|------|-----------|------|
| 테스트 | 0개 파일, 프레임워크 미설치 | 순수 함수 80%+ 커버리지 |
| 크래시 리포팅 | console.warn만 사용 | Sentry 연동, 실시간 모니터링 |
| 에러 처리 | try-catch + console | 구조화된 에러 리포팅 |
| DB 마이그레이션 | duplicate column 무시 방식 | 버전 기반 순차 마이그레이션 |
| 성능 | O(n) 배열 복사, 전체 로드 | O(1) push, 페이지네이션 |
| 접근성 | 속성 0개 | 핵심 흐름 VoiceOver 지원 |
| 오프라인 | 처리 없음 | 감지 + 폴백 UI |
| 개인정보 | 정책 없음 | 보존 기간 + 삭제 기능 |
| CI/CD | 수동 빌드 | PR 자동 체크 + 빌드 |

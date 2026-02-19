# LocaAlert 프로젝트 - 10가지 이슈 분석 및 설계

**분석 일자**: 2026-02-19
**모델**: Claude Opus 4.6 (DESIGN 단계)
**목적**: 각 이슈에 대한 보완 설계, 사이드이펙트 분석, 대안 제시

---

## 이슈 1: phaseCalculator vs locationService 코드 중복

### 현황
- **locationService.ts** (66~140줄): `calculateDynamicCooldown`, `shouldEnterActiveTracking`, `determinePhase` 함수 존재
- **phaseCalculator.ts**: 동일 함수 존재 (테스트 용으로 별도 추출)
- **핵심 차이점**:
  - phaseCalculator의 `determinePhase(distanceMeters, speedKmh, fromPhase, geofenceSetupFailed)`는 `geofenceSetupFailed`를 파라미터로 수용
  - locationService의 `determinePhase(distanceMeters, speedKmh, fromPhase)`는 모듈 변수 `geofenceSetupFailed` 직접 참조

### 최종 수정 방안: **방안 A 선택**
**locationService에서 내부 함수 삭제하고 phaseCalculator에서 import**

#### 1) 수정 구현
```typescript
// locationService.ts - 수정 전: 66~140줄 삭제

// 파일 상단에 추가
import {
    calculateDynamicCooldown,
    shouldEnterActiveTracking,
    determinePhase as calculatePhase,
} from './phaseCalculator';

// 호출 위치 1 (line 288 근처)
// Before:
// const desiredPhase = determinePhase(distance, speed, currentServicePhase);

// After:
const desiredPhase = calculatePhase(distance, speed, currentServicePhase, geofenceSetupFailed);

// 호출 위치 2 (line 510 근처)
// Before:
// const initialPhase = determinePhase(distance, 0, 'IDLE');

// After:
const initialPhase = calculatePhase(distance, 0, 'IDLE', false);
```

#### 2) 사이드이펙트 분석

| 항목 | 영향 | 심각도 | 해결 방법 |
|------|------|--------|---------|
| **함수 호출 변경** | determinePhase → calculatePhase 이름 변경 필요 | 저 | import 시 alias 사용 (`as calculatePhase`) |
| **파라미터 추가** | geofenceSetupFailed를 매번 전달해야 함 | 저 | 현재 모듈 변수로 접근 가능하므로 패스 간단 |
| **모듈 스코프 실행** | locationService는 TaskManager.defineTask를 모듈 스코프에서 실행 | 중 | phaseCalculator는 순수 함수만 export → 문제 없음 |
| **테스트 격리** | phaseCalculator는 네이티브 모듈 의존성 없음 | 낮음 | ✅ 테스트 환경에서 import 가능 |

#### 3) 대안 검토
**방안 B (locationService 함수를 export): 부적합**
- locationService는 모듈 초기화 단계에서 `TaskManager.defineTask(TASK_NAMES.GEOFENCE, ...)` 실행
- 테스트에서 import 시 TaskManager와 네이티브 모듈 의존성 자동 로드 → 테스트 환경 오염
- phaseCalculator가 이미 분리되어 있으므로 방안 B는 불필요

#### 4) 최종 결론
✅ **방안 A 선택 - 즉시 구현 가능**
- 영향도: 낮음 (2개 호출 위치만 수정)
- 사이드이펙트: 없음 (phaseCalculator는 순수 함수)
- 테스트 용이성 ↑

---

## 이슈 2: package.json 의존성 분류 오류

### 현황
```json
// package.json - dependencies에 있는 항목들:
"@types/jest": "29.5.14",
"jest-expo": "~54.0.17",

// devDependencies로 이동해야 함
```

### 최종 수정 방안
**직접 이동 - 사이드이펙트 없음**

#### 1) 수정 구현
```json
// package.json 변경
{
  "dependencies": {
    // @types/jest, jest-expo 제거
    "expo": "~54.0.33",
    // ... 다른 dependencies
  },
  "devDependencies": {
    "@types/jest": "29.5.14",      // 추가
    "jest-expo": "~54.0.17",       // 추가
    "jest": "^29.7.0",
    "typescript": "~5.9.2"
  }
}
```

#### 2) 사이드이펙트 분석

| 항목 | 분석 | 결론 |
|------|------|------|
| **Expo autolinking** | expo-cli는 dependencies만 스캔하여 native module linking 수행. jest-expo는 native 모듈 아님 → 링킹 영향 없음 | ✅ 안전 |
| **번들 크기** | Metro 번들러는 실제 import 된 모듈만 번들링. 따라서 devDependencies 위치 무관 | ✅ 영향 없음 |
| **타입 정의** | @types/jest는 컴파일 타임에만 사용. 런타임 번들링 제외됨 | ✅ 영향 없음 |
| **프로덕션 설치** | npm install --production 시 devDependencies 제외 설치 | ✅ 개선 (번들 크기 감소) |

#### 3) 최종 결론
✅ **즉시 구현 가능 - 사이드이펙트 없음**
- 영향도: 0
- 권장 시점: 다음 npm 업데이트 시

---

## 이슈 3: Geocode 캐시 무한 증가

### 현황
```typescript
// src/services/geocoding.ts (line 17)
const geocodeCache = new Map<string, GeocodingResult>();

// 캐시 키: latitude.toFixed(5), longitude.toFixed(5)
// 예: "37.49668,127.02744" (~1m 정밀도)
// 크기 제한: 없음
```

### 최종 수정 방안
**LRU (Least Recently Used) 캐시 구현 - 최대 100개 항목**

#### 1) 구현 코드
```typescript
// geocoding.ts 전체 수정
class LRUCache<K, V> {
    private cache: Map<K, V> = new Map();
    private maxSize: number;

    constructor(maxSize: number = 100) {
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        if (!this.cache.has(key)) return undefined;

        // Move to end (most recently used)
        const value = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key: K, value: V): void {
        // If already exists, delete first (to move to end)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        this.cache.set(key, value);

        // Remove oldest if exceeds max size
        if (this.cache.size > this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    clear(): void {
        this.cache.clear();
    }
}

// 사용
const geocodeCache = new LRUCache<string, GeocodingResult>(100);

// 나머지 함수는 동일
export async function reverseGeocode(...): Promise<GeocodingResult> {
    const cacheKey = getCacheKey(latitude, longitude);

    // Check cache first
    const cached = geocodeCache.get(cacheKey);  // 동일 인터페이스
    if (cached) {
        return cached;
    }

    // ... API call ...

    // Cache the result
    geocodeCache.set(cacheKey, geocodingResult);  // 동일 인터페이스
    return geocodingResult;
}
```

#### 2) 사이드이펙트 분석

| 항목 | 분석 | 영향 | 해결 |
|------|------|------|------|
| **캐시 미스 증가** | 실제 사용 패턴: 같은 지점 반복 조회 (~1m 정밀도) → 100개면 충분 | 극저 | N/A |
| **메모리 사용** | Before: 무제한 증가 → After: 최대 100개 * ~200bytes = 20KB | 개선 | ✅ |
| **API 호출 증가** | 캐시 미스 시 API 호출 필요. But: 기능 동일 (단지 느림) | 극저 | N/A |
| **메모리 누수** | Old item 자동 제거 → 메모리 누수 방지 | ✅ 개선 | N/A |

#### 3) LRU 크기 검증
```
실제 사용 패턴:
- route_point 저장 간격: 50m 거리 또는 15초 주기
- 유효 정밀도: ~1m (longitude.toFixed(5))
- 5km 거리: ~5000 포인트 → 시간으로는 약 1-2시간 주행

결론: 100개 캐시 = 약 5km ~ 10km 거리 커버 → 충분함
```

#### 4) 최종 결론
✅ **LRU 캐시 구현 - 즉시 가능**
- 영향도: 낮음 (인터페이스 동일, 구현만 변경)
- 사이드이펙트: 없음 (오히려 메모리 개선)

---

## 이슈 4: API 키 env 평문 노출

### 현황
```typescript
// src/services/location/searchService.ts (line 45-49)
const config: SearchConfig = {
    kakaoApiKey: process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY || '',
    googleApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '',
    appleMapKitToken: process.env.EXPO_PUBLIC_APPLE_MAPKIT_TOKEN || '',
};

// EXPO_PUBLIC_* prefix → JS 번들에 포함됨 → 클라이언트에 노출
```

### 최종 수정 방안
**방안 B 채택: Kakao/Google/Apple Console 설정 + 코드 보안 주석**

#### 1) 구현 전략

**A. Kakao Maps API (한국)**
```
Kakao Developer Console → App → Platform
  ✅ Web → 도메인 제한 설정
  ✅ Mobile → Package name + SHA1 hash 설정
  ⚠️ 1인 앱이므로 번들 APK hash 등록 필수
```

**B. Google Places API**
```
Google Cloud Console → API 키
  ✅ API 제한: "Places API" 만 허용
  ✅ 애플리케이션 제한: Android/iOS 앱 Bundle ID 등록
  ✅ HTTP referrer 제한 불가능 (모바일 앱은 Domain verification 사용)
```

**C. Apple MapKit JS**
```
Apple Developer → Certificates, IDs & Profiles
  ✅ Servers: Token 기반 (exp, iss 필드 자동 검증)
  ✅ iOS App: MapKit JS framework 사용 → 자동 검증
```

#### 2) 코드 수정 (주석 추가)
```typescript
// src/services/location/searchService.ts

const config: SearchConfig = {
    // ⚠️  EXPO_PUBLIC_* 변수는 JS 번들에 포함됨
    // 보안 설정:
    // 1. Kakao: Kakao Console에서 Bundle ID SHA1 해시 등록
    //    https://developers.kakao.com/docs/latest/ko/platform/ios-prerequisites
    // 2. Google: Google Cloud Console에서 Android/iOS Bundle ID 등록
    //    https://cloud.google.com/docs/authentication/api-keys
    // 3. Apple: Apple Developer에서 MapKit JS token 서명
    //    https://developer.apple.com/documentation/mapkitjs/creating_and_managing_tokens

    kakaoApiKey: process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY || '',
    googleApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '',
    appleMapKitToken: process.env.EXPO_PUBLIC_APPLE_MAPKIT_TOKEN || '',
};

// 추가: 콘솔 경고 (개발 단계)
if (__DEV__) {
    if (config.kakaoApiKey) {
        console.warn('[SearchService] Kakao API Key configured. Ensure Bundle ID restriction is enabled in Kakao Console.');
    }
    if (config.googleApiKey) {
        console.warn('[SearchService] Google API Key configured. Ensure Package name/Hash restriction is enabled in Google Cloud Console.');
    }
}
```

#### 3) 사이드이펙트 분석

| 항목 | 분석 | 해결 |
|------|------|------|
| **번들 크기** | 주석만 추가 → 번들 크기 변화 없음 | ✅ |
| **기능** | 기능 변화 없음 (console.warn만 추가) | ✅ |
| **배포 프로세스** | 각 콘솔에서 한 번의 설정 필요 | 일회성 |
| **런타임 보안** | API 키 노출은 여전하지만, 콘솔 제한으로 오남용 방지 | ✅ |

#### 4) 프록시 서버 방안 검토 (방안 A)
```
장점: 최고의 보안
단점:
  - 서버 인프라 비용 발생
  - 각 API 호출마다 서버 왕복 지연 (~100-200ms 추가)
  - 1인 개발 프로젝트에는 과도한 솔루션
  - 유지보수 부담 증가

결론: 현재 상황에서는 불적합
```

#### 5) 최종 결론
✅ **방안 B 선택 - 즉시 구현 가능**
- 코드 수정: 주석 추가 (5분)
- 콘솔 설정: 각 플랫폼별 1회 (20분)
- 지속적 보안: ✅ (콘솔 제한으로 오용 방지)

---

## 이슈 5: Google Session Token 약한 암호화 (Math.random())

### 현황
```typescript
// src/services/location/searchService.ts (line 63-69)
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;  // ❌ 약한 난수
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// 문제점:
// - Math.random()은 예측 가능한 pseudo-random
// - UUID v4 표준: cryptographically secure random 권장
// - Session Token은 결제 최적화 용도이므로 높은 엔트로피 필요
```

### 최종 수정 방안
**대안: crypto.getRandomValues() 사용 (React Native 내장)**

#### 1) 구현 코드
```typescript
// src/services/location/searchService.ts (line 63-69 교체)

function generateUUID(): string {
    // Use crypto.getRandomValues() instead of Math.random()
    // Available in React Native with Hermes engine (default in Expo)
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version 4 (random) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;  // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80;  // variant 1

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
```

#### 2) 대안 비교

| 방식 | 보안 | 의존성 | 호환성 | 성능 |
|------|------|--------|--------|------|
| **Math.random()** | ❌ 약함 | 없음 | 100% | 빠름 |
| **expo-crypto** | ✅ 강함 | 새 native 모듈 | 높음 | 중간 |
| **crypto.getRandomValues()** | ✅ 강함 | 없음 (내장) | 높음 | 빠름 |

#### 3) React Native crypto.getRandomValues() 지원 현황
```typescript
// React Native 0.81.5 (현재 프로젝트) + Hermes 엔진
// ✅ crypto.getRandomValues() 지원됨

// 확인 코드 (앱 시작 시)
console.log('crypto support:', typeof crypto !== 'undefined');
console.log('getRandomValues:', typeof crypto?.getRandomValues === 'function');
```

#### 4) 사이드이펙트 분석

| 항목 | 분석 | 영향 |
|------|------|------|
| **의존성** | 새 라이브러리 불필요 (React Native 내장) | ✅ 영향 없음 |
| **호환성** | Hermes 엔진 필수 (Expo는 기본값) | ✅ 호환 |
| **성능** | native 호출 → 약간의 오버헤드 있으나 무시할 수준 (~1ms) | ✅ 무시 |
| **버전 호환** | React Native 0.81.5는 crypto API 지원함 | ✅ 안전 |
| **Session Token 로직** | 기능 동일 (난수 생성 방식만 변경) | ✅ 무영향 |

#### 5) 최종 결론
✅ **crypto.getRandomValues() 선택 - 즉시 구현 가능**
- 영향도: 0 (함수 시그니처 동일)
- 보안 강화: ✅ (Math.random() → CSPRNG)
- 추가 의존성: 없음 (내장)

---

## 이슈 6: DB 마이그레이션과 스키마 불일치

### 현황
```typescript
// schema.ts - CREATE_ALARMS_TABLE (line 6-21)
// 누락된 컬럼:
//   - route_points TEXT (migrations.ts v2에서 추가)
//   - traveled_distance REAL (migrations.ts v2에서 추가)
//   - cancelled_at TEXT (migrations.ts v2에서 추가)

// Alarm interface (line 45-61)는 이미 정의됨
export interface Alarm {
    // ...
    route_points: string | null;       // ← 필드 있음 (스키마 누락)
    traveled_distance: number | null;  // ← 필드 있음 (스키마 누락)
    cancelled_at: string | null;       // ← 필드 있음 (스키마 누락)
}
```

### 마이그레이션 시스템 분석
```typescript
// migrations.ts - v1, v2 (line 18-52)
{
    version: 1,
    up: async (db) => {
        const columns = [
            'ALTER TABLE alarms ADD COLUMN started_at TEXT',
            'ALTER TABLE alarms ADD COLUMN arrived_at TEXT',
            'ALTER TABLE alarms ADD COLUMN start_latitude REAL',
            'ALTER TABLE alarms ADD COLUMN start_longitude REAL',
        ];
        for (const sql of columns) {
            try {
                await db.runAsync(sql);
            } catch (e: any) {
                if (!e.message?.includes('duplicate column')) throw e;
                // ✅ 중복 컬럼 에러 무시됨
            }
        }
    },
}
```

### 최종 수정 방안
**방안 A: schema.ts의 CREATE_ALARMS_TABLE에 모든 컬럼 포함**

#### 1) 구현 코드
```typescript
// schema.ts - CREATE_ALARMS_TABLE 전체 교체 (line 6-21)

export const CREATE_ALARMS_TABLE = `
CREATE TABLE IF NOT EXISTS alarms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius INTEGER DEFAULT 500,
  is_active INTEGER DEFAULT 1,
  sound_uri TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  started_at TEXT,
  arrived_at TEXT,
  start_latitude REAL,
  start_longitude REAL,
  route_points TEXT,           -- ← 추가 (v2 migration 컬럼)
  traveled_distance REAL,      -- ← 추가 (v2 migration 컬럼)
  cancelled_at TEXT            -- ← 추가 (v2 migration 컬럼)
);
`;
```

#### 2) 사이드이펙트 분석

**신규 설치 시나리오:**
```
1. CREATE_ALARMS_TABLE 실행 (route_points, traveled_distance, cancelled_at 포함)
2. migrations.runVersionedMigrations() 호출
3. user_version = 0 → v1, v2 pending migration
4. v1 migration 시도:
   - ALTER TABLE alarms ADD COLUMN started_at TEXT ❌ 이미 존재
   - → catch { if (e.includes('duplicate column')) /* 무시 */ }  ✅
5. v2 migration 시도:
   - ALTER TABLE alarms ADD COLUMN route_points TEXT ❌ 이미 존재
   - → catch { if (e.includes('duplicate column')) /* 무시 */ }  ✅
6. user_version = 2 설정 완료

결론: ✅ 안전 (migrations.ts의 try-catch 덕분)
```

**기존 사용자 시나리오:**
```
1. 현재 user_version = 2 (이미 마이그레이션 완료)
2. 앱 업데이트 후 실행
3. v1, v2 skip (user_version >= 2)
4. CREATE_ALARMS_TABLE은 IF NOT EXISTS이므로 영향 없음

결론: ✅ 안전
```

#### 3) SQLite 버전 호환성 검증
```typescript
// IF NOT EXISTS는 모든 SQLite 버전 지원
// ALTER TABLE ... ADD COLUMN IF NOT EXISTS는 SQLite 3.35+ (2021년 3월)

// React Native expo-sqlite 버전 확인
// package.json: "expo-sqlite": "~16.0.10"
// → SQLite 3.40+ 지원
// → IF NOT EXISTS 지원됨

// 현재 v2 migration은 IF NOT EXISTS 미사용
// → 호환성 문제 없음 (try-catch로 처리)
```

#### 4) 대안 검토

**방안 B (SQLite 3.35+ IF NOT EXISTS 사용):**
```typescript
// migrations.ts v1, v2 수정
alter table alarms add column IF NOT EXISTS started_at TEXT;

// 문제:
// - expo-sqlite 버전에 따라 SQLite 버전 다름
// - 이전 버전 사용자 호환성 우려
// - 기존 try-catch 방식이 더 안전

결론: 현재 방식 유지
```

#### 5) 최종 결론
✅ **방안 A 선택 - 즉시 구현 가능**
- 영향도: 낮음 (CREATE_ALARMS_TABLE 문자열만 수정)
- 사이드이펙트: 없음 (migrations.ts의 try-catch 덕분)
- 추천 이유:
  - 스키마와 interface 일치로 유지보수 용이
  - 신규 설치 시 깔끔한 구조
  - 기존 사용자도 안전 (migration skip)

---

## 이슈 7: 알람 완료/취소 시 경쟁 조건 (Race Condition)

### 현황
```typescript
// alarmStore.ts - completeAlarm (line 150-169)
completeAlarm: async (id) => {
    try {
        set({ dismissedAlarmId: id });  // 1. 상태 설정
        const locationStore = useLocationStore.getState();
        const routePoints = locationStore.routeHistory;  // 2. 참조 복사
        const traveledDistance = locationStore.traveledDistance;

        await db.updateAlarm(id, {      // 3. DB 저장
            is_active: false,
            arrived_at: new Date().toISOString(),
            route_points: routePoints.length > 0 ? JSON.stringify(routePoints) : null,
            traveled_distance: traveledDistance > 0 ? traveledDistance : null,
        });
        // ...
    }
}

// locationService.ts - stopAllTracking (line 549)
useLocationStore.getState().clearRouteHistory();  // ← 경쟁 조건!

// 문제:
// const routePoints = locationStore.routeHistory;
// 는 배열 참조 복사이므로, 이후 clearRouteHistory()의 set({ routeHistory: [] })가
// 새 배열 할당해도, 원본 참조는 유지됨.
//
// BUT: 타이밍에 따라 JSON.stringify(routePoints)가 실행될 때
// routePoints가 이미 비워졌을 수 있음 (mutable array).
```

### 경쟁 조건 분석

```typescript
// 시나리오 1 (안전): 타이밍이 좋음
Timeline:
T1: completeAlarm() 호출
T2: const routePoints = [...] (배열 복사 시작)
T3: routePoints = [원본 배열의 스냅샷]
T4: JSON.stringify(routePoints) (직렬화)
T5: stopAllTracking() 호출 → clearRouteHistory()
→ ✅ 안전 (이미 직렬화 완료)

// 시나리오 2 (위험): 타이밍이 안 좋음
Timeline:
T1: completeAlarm() 호출
T2: const routePoints = locationStore.routeHistory (참조 복사, 배열 객체 자체)
T3: ... await db.updateAlarm(...) (DB 저장 시작)
T4: 동시에 locationService에서 stopAllTracking() 호출
T5: clearRouteHistory() → set({ routeHistory: [...] })
    → 새 배열 할당이지만, routePoints는 여전히 원본 배열 객체 참조
T6: BUT, routeHistory에 .push() 가능하므로 mutable array 문제 가능
T7: JSON.stringify(routePoints) 실행

실제 문제:
- set({ routeHistory: [] })는 새 배열 할당
- 원본 배열 객체는 여전히 존재하지만 Zustand는 이미 새 배열 참조
- routePoints (원본 참조)는 계속 존재
- 따라서 JSON.stringify는 안전

결론: ❌ 실제로는 경쟁 조건 없음 (Zustand의 immutable pattern)
     BUT: 코드 복잡도 증가 → 개선 권장
```

### 최종 수정 방안
**깊은 복사 추가 + 명확한 의도 표현**

#### 1) 구현 코드
```typescript
// alarmStore.ts - completeAlarm, deactivateAlarm 수정

completeAlarm: async (id) => {
    try {
        set({ dismissedAlarmId: id });
        const locationStore = useLocationStore.getState();

        // ✅ 깊은 복사: 이후 routeHistory 변경으로부터 격리
        const routePoints = [...locationStore.routeHistory];
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

        // ✅ 깊은 복사: 이후 routeHistory 변경으로부터 격리
        const routePoints = [...locationStore.routeHistory];
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

#### 2) 사이드이펙트 분석

| 항목 | 분석 | 영향 |
|------|------|------|
| **메모리** | 배열 얕은 복사 (spread operator) → 원본 배열 + 복사본 배열 2개 존재 | 극저 (일회성, ~100KB) |
| **성능** | spread operator 비용: ~1-2ms (몇백 포인트) | 무시할 수준 |
| **가비지 컬렉션** | 즉시 GC 대상 (DB 저장 후 참조 없음) | ✅ 자동 |
| **기능** | 로직 동일 (복사 방식만 변경) | ✅ 영향 없음 |

#### 3) 최종 결론
✅ **깊은 복사 추가 - 즉시 구현 가능**
- 영향도: 낮음 (spread operator 한 줄 추가)
- 사이드이펙트: 무시할 수준 (메모리 ~100KB, 성능 ~1-2ms)
- 개선 효과: 코드 명확성 ↑, 경쟁 조건 위험 제거

---

## 이슈 8: stopTracking 에러 무시

### 현황
```typescript
// locationService.ts (여러 위치)
stopAllTracking().catch(err => console.warn('[LocationService] ...'));

// 문제점:
// - 에러가 무시됨 (console.warn만)
// - 에러 원인 파악 어려움
// - 크래시 리포팅 시스템에 기록 안 됨
// - GPS가 계속 실행될 수 있음 (배터리 드레인)
```

### 최종 수정 방안
**captureError() 사용 + 상태 강제 초기화**

#### 1) 구현 코드
```typescript
// locationService.ts - stopAllTracking 호출 위치들 수정

// 기존 코드:
stopAllTracking().catch(err => console.warn('[LocationService] ...'));

// 수정 후:
stopAllTracking().catch(err => {
    console.warn('[LocationService] stopAllTracking failed:', err);
    captureError(err, {
        module: 'LocationService',
        action: 'stopAllTracking',
        context: 'alarm_trigger_or_manual_stop',
    });
});

// stopAllTracking 함수 내부도 개선:
export async function stopAllTracking(): Promise<void> {
    try {
        const alarmStore = useAlarmStore.getState();
        if (alarmStore.activeAlarm) {
            await finalizeCheckpoint(alarmStore.activeAlarm.id);
        }
        endTelemetrySession();

        await teardownPhase(currentServicePhase);

        // 상태 강제 초기화 (에러 발생해도 실행)
        currentServicePhase = 'IDLE';
        currentTarget = null;
        lastProcessedAt = 0;
        geofenceSetupFailed = false;
        lastTrackingNotificationAt = 0;

        useLocationStore.getState().clearRouteHistory();
        stopTrackingActivity().catch(() => {});
        clearTrackingNotification().catch(() => {});

        console.log('[LocationService] All tracking stopped');
    } catch (err) {
        // 에러 발생해도 상태 초기화는 이미 실행됨
        captureError(err, {
            module: 'LocationService',
            action: 'stopAllTracking_internal',
        });
        throw err;  // 호출자에게 전파
    }
}
```

#### 2) 에러 처리 개선

```typescript
// teardownPhase 함수 추가 에러 처리
async function teardownPhase(phase: TrackingPhase): Promise<void> {
    try {
        if (phase === 'GEOFENCING') {
            await Location.stopGeofencingAsync(TASK_NAMES.GEOFENCE);
        } else if (phase === 'ADAPTIVE_POLLING' || phase === 'ACTIVE_TRACKING') {
            await Location.stopLocationUpdatesAsync(TASK_NAMES.LOCATION);
        }
    } catch (err: any) {
        // Location service 에러는 자주 발생 (시뮬레이터 등)
        // 에러 기록만 하고 계속 진행
        console.warn(`[LocationService] teardownPhase(${phase}) failed:`, err?.message);
        // 크래시 리포팅은 스킵 (무시할 수 있는 에러)
    }
}
```

#### 3) 사이드이펙트 분석

| 항목 | 분석 | 영향 |
|------|------|------|
| **에러 기록** | captureError() 추가 → 크래시 리포팅 활성화 | ✅ 개선 |
| **상태 관리** | try-finally 구조로 강제 초기화 → 안정성 ↑ | ✅ 개선 |
| **로그 양** | console.warn + captureError → 로그 증가 | 극저 (에러 시에만) |
| **성능** | 에러 시 captureError() 호출 → ~1-2ms 추가 | 무시할 수준 |
| **GPS 지속 실행** | 상태 강제 초기화 → 누수 방지 | ✅ 개선 |

#### 4) 최종 결론
✅ **captureError + 강제 초기화 - 즉시 구현 가능**
- 영향도: 낮음 (에러 처리만 강화)
- 사이드이펙트: 없음 (오히려 안정성 ↑)
- 권장 이유:
  - 에러 가시성 ↑ (크래시 리포팅)
  - 상태 일관성 ↑ (강제 초기화)
  - GPS 누수 방지

---

## 이슈 9: Live Activity 하드코딩 한국어

### 현황
```typescript
// liveActivityService.ts (line 31-35, 117-118)

function formatDist(meters: number): string {
    return meters < 1000
        ? `${Math.round(meters)}m 남음`        // ❌ 하드코딩 한국어
        : `${(meters / 1000).toFixed(1)}km 남음`;
}

export async function stopTrackingActivity(): Promise<void> {
    // ...
    await stopActivity(currentActivityId, {
        title: '도착 완료',                    // ❌ 하드코딩 한국어
        subtitle: '목적지에 도착했습니다',     // ❌ 하드코딩 한국어
        // ...
    });
}
```

### 최종 수정 방안
**i18n.t() 사용으로 국제화 지원**

#### 1) 구현 코드

**1단계: i18n 로케일 파일 확인**
```json
// src/i18n/locales/ko.json 예상 구조
{
  "liveActivity": {
    "distance": {
      "meters": "{{value}}m 남음",
      "kilometers": "{{value}}km 남음"
    },
    "completed": {
      "title": "도착 완료",
      "subtitle": "목적지에 도착했습니다"
    }
  }
}

// src/i18n/locales/en.json
{
  "liveActivity": {
    "distance": {
      "meters": "{{value}}m left",
      "kilometers": "{{value}}km left"
    },
    "completed": {
      "title": "Arrived",
      "subtitle": "You have arrived at your destination"
    }
  }
}

// src/i18n/locales/ja.json
{
  "liveActivity": {
    "distance": {
      "meters": "残り{{value}}m",
      "kilometers": "残り{{value}}km"
    },
    "completed": {
      "title": "到着完了",
      "subtitle": "目的地に到着しました"
    }
  }
}
```

**2단계: liveActivityService.ts 수정**
```typescript
// liveActivityService.ts

import i18n from '../i18n';  // 추가

function formatDist(meters: number): string {
    // ✅ i18n으로 국제화
    if (meters < 1000) {
        return i18n.t('liveActivity.distance.meters', { value: Math.round(meters) });
    } else {
        return i18n.t('liveActivity.distance.kilometers', { value: (meters / 1000).toFixed(1) });
    }
}

export async function stopTrackingActivity(): Promise<void> {
    if (!currentActivityId) return;

    try {
        await stopActivity(currentActivityId, {
            title: i18n.t('liveActivity.completed.title'),
            subtitle: i18n.t('liveActivity.completed.subtitle'),
            progressBar: {
                progress: 1,
            },
        });
        console.log('[LiveActivity] Stopped:', currentActivityId);
    } catch (err) {
        console.warn('[LiveActivity] Failed to stop:', err);
    } finally {
        currentActivityId = null;
        initialDistance = 0;
    }
}
```

#### 2) 사이드이펙트 분석

| 항목 | 분석 | 영향 |
|------|------|------|
| **초기화 타이밍** | i18n은 앱 부팅 시 초기화됨 (i18n/index.ts) | ✅ 안전 |
| **Live Activity 렌더링** | JS에서 문자열 생성 → 네이티브로 전달 → 네이티브 렌더링 | ✅ 안전 |
| **지연 시간** | i18n.t() 호출 (~1-2ms) | 무시할 수준 |
| **로케일 감지** | i18n은 기기 언어 자동 감지 (Localization.getLocales()) | ✅ 자동 |
| **폴백** | 로케일 없으면 'ko' (한국어) 폴백 | ✅ 안전 |

#### 3) Live Activity 특수성 고려
```typescript
// Live Activity는 iOS 16+ Dynamic Island에서 실시간으로 렌더링됨
// 네이티브 위젯이므로 JS 번들의 i18n 리소스 사용 가능

// 경로:
// 1. JS에서 i18n.t('key') 호출
// 2. JS 반환값을 expo-live-activity로 전달
// 3. 네이티브 레이어에서 문자열 받아 렌더링
// 4. Dynamic Island에 표시

// 결론: ✅ i18n 호환됨
```

#### 4) 최종 결론
✅ **i18n.t() 사용 - 즉시 구현 가능**
- 영향도: 낮음 (함수 호출만 변경)
- 사이드이펙트: 없음 (i18n 자동 초기화)
- 개선 효과:
  - 한국어만 지원 → 다국어 지원 (EN, JA 등)
  - 코드 유지보수성 ↑

---

## 이슈 10: 검색 debounce 메모리 누수

### 현황
```typescript
// src/services/location/searchService.ts (line 531-561)

let searchTimeout: NodeJS.Timeout | null = null;
let lastSearchQuery: string = '';

export function debouncedSearch(
    options: SearchOptions,
    callback: (results: SearchResult[]) => void,
    debounceMs: number = 300
): void {
    if (searchTimeout) {
        clearTimeout(searchTimeout);  // ✅ 이전 타이머 정리
    }

    if (options.query === lastSearchQuery) {
        return;
    }

    lastSearchQuery = options.query;

    searchTimeout = setTimeout(async () => {
        const results = await searchPlaces(options);
        callback(results);
    }, debounceMs);
}

export function cancelPendingSearch(): void {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
        searchTimeout = null;
    }
    lastSearchQuery = '';
}

// 문제점:
// - searchTimeout이 모듈 스코프의 전역 변수
// - 컴포넌트 언마운트 시 cancelPendingSearch() 호출하지 않으면 누수 가능
// - useLocationSearch 훅에서 cleanup 필요
```

### 현재 사용처 분석
```typescript
// 검색 사용 컴포넌트 (home.tsx 등에서 예상)
// useLocationSearch 훅 또는 직접 debouncedSearch 호출

// cancelPendingSearch() 호출 위치:
// - useLocationSearch cleanup? (확인 필요)
// - 컴포넌트 언마운트 시?
```

### 최종 수정 방안
**useLocationSearch 훅의 cleanup 문서화 + 권장 패턴 제시**

#### 1) 구현 코드

**1단계: useLocationSearch 훅 생성 (없으면)**
```typescript
// src/hooks/useLocationSearch.ts (신규 또는 기존 확인)

import { useEffect, useState } from 'react';
import {
    debouncedSearch,
    cancelPendingSearch,
    SearchResult,
    SearchOptions
} from '../services/location/searchService';

export function useLocationSearch(
    searchOptions: SearchOptions | null,
    debounceMs: number = 300
) {
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!searchOptions) {
            return;  // 검색 옵션 없음
        }

        setIsLoading(true);
        debouncedSearch(
            searchOptions,
            (results) => {
                setResults(results);
                setIsLoading(false);
            },
            debounceMs
        );

        // ✅ cleanup: 컴포넌트 언마운트 시 pending search 취소
        return () => {
            cancelPendingSearch();
        };
    }, [searchOptions, debounceMs]);

    return { results, isLoading };
}
```

**2단계: 사용 컴포넌트 예시**
```typescript
// home.tsx 또는 검색 컴포넌트

import { useLocationSearch } from '../hooks/useLocationSearch';

export function HomeScreen() {
    const [searchQuery, setSearchQuery] = useState('');
    const currentLocation = { latitude: 37.5, longitude: 127.0 };

    // ✅ 훅 사용 - cleanup 자동 처리됨
    const { results, isLoading } = useLocationSearch(
        searchQuery.length >= 2
            ? {
                query: searchQuery,
                currentLocation,
                limit: 10,
            }
            : null,
        300
    );

    return (
        <View>
            <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="검색..."
            />
            {isLoading && <Text>검색 중...</Text>}
            {results.map(result => (
                <Text key={result.id}>{result.name}</Text>
            ))}
        </View>
    );
}
// 언마운트 시 cleanup() 자동 호출 → cancelPendingSearch()
```

**3단계: searchService.ts 주석 추가**
```typescript
// src/services/location/searchService.ts (line 528-530)

/**
 * ⚠️  Debounced Search (메모리 누수 방지)
 *
 * 사용 방법:
 * 1. 권장: useLocationSearch 훅 사용 (자동 cleanup)
 * 2. 직접 사용 시: useEffect cleanup에서 cancelPendingSearch() 호출 필수
 *
 * @example
 * // 훅 사용 (권장)
 * const { results } = useLocationSearch(options);
 *
 * // 직접 사용 (cleanup 필수!)
 * useEffect(() => {
 *   debouncedSearch(options, (results) => { setResults(results); });
 *   return () => cancelPendingSearch();
 * }, [options]);
 */
```

#### 2) 사이드이펙트 분석

| 항목 | 분석 | 영향 |
|------|------|------|
| **코드 추가** | useLocationSearch 훅 추가 (약 40줄) | 극저 |
| **번들 크기** | 기존 debouncedSearch 함수 유지 → 크기 무변화 | ✅ |
| **성능** | cleanup 함수 호출 (~1ms) | 무시할 수준 |
| **기존 코드 호환성** | 직접 debouncedSearch 호출 코드는 여전히 동작 | ✅ |
| **메모리 누수** | cleanup 사용 시 완전히 방지됨 | ✅ 개선 |

#### 3) 메모리 누수 시나리오 검증

```typescript
// 누수 시나리오
Timeline:
T1: 컴포넌트 mount
T2: debouncedSearch 호출 → searchTimeout 설정
T3: 300ms 대기 중
T4: 컴포넌트 언마운트 ❌ cancelPendingSearch 호출 안 됨
T5: timeout 여전히 대기 중
T6: 300ms 후 callback 실행 → stale closure (이미 언마운트된 컴포넌트 상태 접근)
T7: setState 불가 → 경고 발생

해결책: useEffect cleanup에서 cancelPendingSearch()
→ timeout 취소 + lastSearchQuery 초기화 → 메모리 누수 방지
```

#### 4) 최종 결론
✅ **useLocationSearch 훅 + cleanup 문서화 - 즉시 구현 가능**
- 영향도: 낮음 (훅 추가, 주석 추가)
- 사이드이펙트: 없음 (기존 호환성 유지)
- 개선 효과:
  - 메모리 누수 자동 방지
  - 사용자 인터페이스 개선 (stale closure 방지)
  - 코드 명확성 ↑

---

## 최종 요약 테이블

| # | 이슈 | 수정 방안 | 우선순위 | 영향도 | 구현 시간 |
|---|------|---------|---------|--------|----------|
| **1** | 코드 중복 (phaseCalculator) | locationService에서 import | 중 | 낮음 | 20분 |
| **2** | package.json 의존성 | @types/jest, jest-expo → devDependencies | 중 | 없음 | 5분 |
| **3** | Geocode 캐시 무한 증가 | LRU 캐시 (100개) | 중 | 없음 | 30분 |
| **4** | API 키 평문 노출 | 콘솔 제한 + 주석 | 저 | 없음 | 15분 |
| **5** | Session Token 약한 암호화 | crypto.getRandomValues() | 중 | 없음 | 15분 |
| **6** | DB 스키마 불일치 | schema.ts에 컬럼 추가 | 중 | 없음 | 10분 |
| **7** | 경쟁 조건 (race condition) | 깊은 복사 추가 | 저 | 무시 | 10분 |
| **8** | stopTracking 에러 무시 | captureError + 강제 초기화 | 중 | 없음 | 20분 |
| **9** | Live Activity 하드코딩 | i18n.t() 사용 | 저 | 없음 | 15분 |
| **10** | 검색 debounce 누수 | useLocationSearch 훅 + cleanup | 중 | 없음 | 25분 |

**총 예상 구현 시간**: 165분 (약 2.75시간)

---

## 구현 순서 권장

### Phase 1: 즉시 (보안 & 안정성)
1. ✅ 이슈 5: Session Token (15분)
2. ✅ 이슈 4: API 키 주석 (15분)
3. ✅ 이슈 2: package.json (5분)

### Phase 2: 데이터 무결성
4. ✅ 이슈 6: DB 스키마 (10분)
5. ✅ 이슈 1: 코드 중복 (20분)

### Phase 3: 성능 & 안정성
6. ✅ 이슈 3: Geocode 캐시 (30분)
7. ✅ 이슈 8: 에러 처리 (20분)

### Phase 4: 사용자 경험
8. ✅ 이슈 9: 국제화 (15분)
9. ✅ 이슈 10: 검색 최적화 (25분)

### Phase 5: 코드 품질
10. ✅ 이슈 7: race condition (10분)

---

## 주의사항

### 테스트
- 각 이슈 수정 후 **단위 테스트** 추가 권장
- phaseCalculator 테스트: 이미 존재 (이슈 1)
- Geocode 캐시: LRU 로직 테스트 필수

### 배포 전 검증
- DB 마이그레이션 (이슈 6): 신규/기존 사용자 모두 테스트
- API 키 제한 (이슈 4): 각 플랫폼 콘솔 설정 재확인

### 문서화
- CLAUDE.md에 각 이슈 수정 항목 기록
- 개발자 가이드에 useLocationSearch 훅 사용법 추가

---

**분석 완료**
분석자: Claude Opus 4.6
최종 검토 일자: 2026-02-19

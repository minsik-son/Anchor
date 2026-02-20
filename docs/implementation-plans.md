# 구현 계획 — 미완성 항목

---

## 4번: Sentry 크래시 리포팅

### 현재 상태
`console.warn/console.error`만 사용 중. 프로덕션 디바이스에서의 크래시 추적 불가.

### 구현 단계

**Step 1: 설치 + 설정**
```bash
npx expo install @sentry/react-native
```

app.json에 플러그인 추가:
```json
["@sentry/react-native/expo", {
    "organization": "locaalert",
    "project": "locaalert-mobile"
}]
```

**Step 2: 초기화 (app/_layout.tsx)**
```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
    dsn: 'YOUR_SENTRY_DSN',  // Sentry.io에서 프로젝트 생성 후 발급
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
});
```

**Step 3: errorReporting.ts 유틸리티 생성**
```typescript
export function captureError(error: unknown, context?: Record<string, any>) {
    console.error(error);
    if (!__DEV__) Sentry.captureException(error, { extra: context });
}
```

**Step 4: 단계별 적용**
- 1단계 (핵심): locationService.ts, notificationService.ts, database.ts
- 2단계 (스토어): alarmStore.ts, locationStore.ts
- 3단계 (나머지): search, challenges, activities

### 필요 조건
- Sentry.io 계정 생성 + 프로젝트 DSN 발급

---

## 5번: Google Places API 제거

### 현재 상태
`searchService.ts`에 Google Places API 코드가 있지만, 실제 사용 우선순위가 낮음:
```
1순위: 한국 → Kakao API  ✅ 동작 중
2순위: iOS 해외 → Apple MapKit JS  ✅ 동작 중
3순위: Android 해외 → Google Places API  ← 이걸 제거
4순위: 최종 폴백 → Expo Location geocoding  ✅ 동작 중
```

### Google의 의존성 범위
- **Places API** (searchService.ts 318-393행): 검색 + 좌표 가져오기 → **제거 대상**
- **Google Maps 렌더링** (react-native-maps): MapView 타일 표시 → **제거 불필요**
  - iOS: 기본 Apple Maps 사용 (PROVIDER_GOOGLE 없이)
  - Android: PROVIDER_GOOGLE으로 Google Maps 타일 사용 중이지만, 이건 Places API와 별개

### 구현 단계

**Step 1: searchService.ts에서 Google Places 코드 제거**
- `searchGoogle()` 함수 제거 (lines 318-360)
- `getGooglePlaceDetails()` 함수 제거 (lines 365-393)
- Google session token 관리 코드 제거 (lines 66-82)
- config에서 `googleApiKey` 제거

**Step 2: searchPlaces() 폴백 체인 변경**
```
변경 전: Korea→Kakao → iOS→Apple → Android→Google → Expo
변경 후: Korea→Kakao → iOS→Apple → Android→OSM/Nominatim → Expo
```

**Step 3: OSM Nominatim 검색 추가 (Android 해외용)**
```typescript
async function searchNominatim(query: string, limit: number): Promise<SearchResult[]> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1`;
    // 무료, API 키 불필요, rate limit만 주의 (1req/sec)
}
```

**Step 4: app.json에서 Google Maps API Key 플레이스홀더 정리**
- Android MapView 렌더링은 react-native-maps 기본 제공자 사용 가능

### 참고
- MapView는 `react-native-maps` 라이브러리이며 Google Places와 무관
- Android에서 `PROVIDER_GOOGLE`을 유지하더라도 Places API 비용 발생 안 함 (Maps SDK는 무료)
- 또는 Android에서도 `PROVIDER_GOOGLE` 제거하고 기본 제공자 사용 가능

---

## 7번: phaseCalculator 코드 중복 정리

### 현재 상태
**이미 해결됨!** 탐색 결과:
- `phaseCalculator.ts` (82행): `determinePhase()`, `calculateDynamicCooldown()`, `shouldEnterActiveTracking()` 등 순수 함수
- `locationService.ts`: `import { determinePhase } from './phaseCalculator'`로 정상 참조

코드 중복이 **이미 정리된 상태**. 추가 작업 불필요.

---

## 8번: Geocode 캐시 LRU 적용

### 현재 상태
**이미 해결됨!** `src/services/geocoding.ts`에 LRU 캐시 구현 완료:
- `MAX_CACHE_SIZE = 100`
- Map 기반 LRU 구현 (삽입 순서 추적, 가장 오래된 항목 제거)
- 좌표 소수점 5자리 반올림 키 (~1m 정밀도)

```typescript
function setCacheEntry(key: string, value: GeocodingResult): void {
    if (geocodeCache.has(key)) geocodeCache.delete(key);
    if (geocodeCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = geocodeCache.keys().next().value;
        geocodeCache.delete(oldestKey);
    }
    geocodeCache.set(key, value);
}
```

추가 개선 가능: AsyncStorage 기반 영구 캐시 (오프라인 지원), 하지만 현재로는 충분.

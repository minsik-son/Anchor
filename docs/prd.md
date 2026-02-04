# [cite_start]PRD Part 1: Core Logic & Architecture [cite: 1]

[cite_start]**Project Name:** (가칭) LocaAlert [cite: 2]
[cite_start]**Version:** 1.0 (MVP) [cite: 3]
[cite_start]**Date:** 2026-02-03 [cite: 4]
[cite_start]**Target Platform:** iOS, Android (Hybrid) [cite: 5]

## 1. 기술 스택 및 라이브러리 선정 (Technical Stack)
[cite_start]가장 중요한 위치 정밀도와 'Toss' 스타일의 퍼포먼스를 내기 위한 확정 스택입니다. [cite: 6]

| 구분 | 기술 스택 | 선정 이유 및 비고 |
| :--- | :--- | :--- |
| **Framework** | React Native (Expo) | 빠른 개발 및 유지보수 용이. (Managed Workflow 권장, 필요 시 Bare 전환) [cite_start][cite: 7] |
| [cite_start]**Map Engine** | react-native-maps | iOS: Google Maps (provider="google" 강제 설정)<br>Android: Google Maps [cite: 7] |
| **Location** | react-native-background-geolocation | (유료 라이브러리급 성능 필요) [cite_start]백그라운드, 배터리 최적화, 모션 감지의 핵심. [cite: 7] |
| **Storage** | SQLite (expo-sqlite) | 로컬 DB. [cite_start]JSON 파일 저장보다 검색/수정 속도 월등함. [cite: 7] |
| **State** | Zustand | [cite_start]Redux보다 가볍고 보일러플레이트가 적어 MVP에 적합. [cite: 8] |
| **Design** | Emotion (Styled) | CSS-in-JS. [cite_start]컴포넌트 단위 스타일링 용이. [cite: 8] |
| **UX Props** | expo-haptics, lottie-react-native | [cite_start]햅틱 피드백 및 마이크로 인터랙션 구현. [cite: 8] |

## [cite_start]2. 핵심 로직 명세 (Core Logic Specifications) [cite: 9]

### [cite_start]2.1 위치 정밀도 및 하이브리드 포지셔닝 (Hybrid Positioning) [cite: 11]
[cite_start]기본 정책: OS의 'High Accuracy' 모드를 사용하되, 라이브러리를 통해 Provider 우선순위를 지정. [cite: 12]
1.  [cite_start]**GNSS (GPS):** 실외, 하늘이 열린 곳 (오차 5~20m). [cite: 13]
2.  [cite_start]**Wi-Fi Positioning (WPS):** 실내, 지하철 역, 빌딩 숲 (MAC 주소 기반 보정). [cite: 14]
3.  [cite_start]**Cell Tower (기지국):** GPS/Wi-Fi 불능 시 최후의 보루 (오차 500m~1km). [cite: 15]
* [cite_start]**보정 로직:** GPS 신호의 정확도(Accuracy) 수치가 50m 이하일 때만 '유효한 위치'로 판별하여 알람 트리거 작동 (튀는 값 방지). [cite: 16]

### [cite_start]2.2 스마트 배터리 세이빙 알고리즘 (Smart Interval) [cite: 17]
[cite_start]사용자의 현재 위치와 목적지까지의 직선거리($D$)에 따라 위치 요청 주기($T$)를 동적으로 변경합니다. [cite: 18]

| 단계 (Phase) | 조건 (남은 거리 D) | 위치 체크 주기 (T) | 센서 모드 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 휴식 모드** | $D > 10km$ | 10분 (or 기지국 변경 시) | Low Power | [cite_start]기지국/Wi-Fi 위주 감지 [cite: 19] |
| **2. 접근 모드** | $2km < D \le 10km$ | 3분 | Balanced | [cite_start]속도 계산 시작 [cite: 20] |
| **3. 준비 모드** | $1km < D \le 2km$ | 1분 | High Accuracy | [cite_start]GPS 예열 시작 [cite: 20] |
| **4. 타겟 모드** | $D \le 1km$ | 실시간 (Distance Filter 10m) | Best Accuracy | [cite_start]즉시 알람 대기 [cite: 20] |

* [cite_start]**동적 속도 계산:** 사용자의 이동 속도가 100km/h(KTX 등) 이상일 경우, 거리 조건을 1.5배 늘려서 미리 준비 태세로 전환. [cite: 21]

### [cite_start]2.3 메모 기능의 진화: "액션 아이템 (Actionable Memo)" [cite: 22]
* **체크리스트형 메모:** "내릴 때 우산 챙기기"처럼 체크박스 형태로 표시. [cite_start]알람을 끌 때 체크를 해야 알람이 멈추도록 설정 가능. [cite: 24, 25]
* [cite_start]**이미지 메모:** 출구 번호나 주변 랜드마크 사진을 등록하면 알람과 함께 팝업. [cite: 26]

### [cite_start]2.3 커스텀 액션 버튼: "이동의 종착역" [cite: 27]
* [cite_start]**Deep Linking:** 버튼 클릭 시 `kakaotaxi://`, `googlemaps://` 등 URL Scheme 호출. [cite: 29, 30]
* [cite_start]**사용자 정의:** 알람 종료 후 실행할 앱을 선택하거나 직접 URL 입력. [cite: 31]
* [cite_start]**UI/UX:** 알람 화면 하단에 제어센터처럼 아이콘 표시. [cite: 32]

### [cite_start]2.4 필수 기능 5가지 (Fail-safe & UX) [cite: 33]
1.  [cite_start]**세이프 가드 (Fail-safe):** GPS 신호 끊김이나 배터리 5% 이하 시 "위치 추적 불안정" 경고 알람. [cite: 34-36]
2.  **지능형 알람 볼륨 (Smart Volume):** 이어폰 연결 시 이어폰으로만 알림, 미연결 시 스피커 사용. [cite_start]목적지 접근 시 볼륨 점증. [cite: 37-39]
3.  [cite_start]**오버레이 권한 관리 가이드:** 안드로이드 '다른 앱 위에 그리기' 권한 온보딩 필수. [cite: 40-42]
4.  [cite_start]**최근 목적지 히스토리:** 최근 설정한 목적지와 반경 데이터를 리스트로 제공. [cite: 43, 44]
5.  [cite_start]**긴급 정지 모드 (Shake to Stop):** 폰을 세게 흔들어 알람 일시 정지(Snooze) 또는 해제. [cite: 45, 46]

## [cite_start]3. 데이터베이스 설계 (Local DB Schema) [cite: 47]

### [cite_start]Table 1: Alarms [cite: 49]
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | 고유 ID |
| `title` | TEXT | 장소 별칭 (예: "피렌체 역") |
| `latitude` | REAL | 위도 |
| `longitude` | REAL | 경도 |
| `radius` | INTEGER | 알람 반경 (미터, Default: 500) |
| `is_active` | BOOLEAN | 알람 활성화 여부 |
| `sound_uri` | TEXT | 알람 사운드 파일 경로 |
| `created_at` | DATETIME | 생성일 |

### [cite_start]Table 2: ActionMemos [cite: 69]
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | 고유 ID |
| `alarm_id` | INTEGER FK | Alarms.id 참조 |
| `type` | TEXT | 'CHECKLIST' or 'IMAGE' |
| `content` | TEXT | 텍스트 or 이미지 경로 |
| `is_checked` | BOOLEAN | 체크리스트 완료 여부 |

### [cite_start]Table 3: CustomActions [cite: 72]
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | 고유 ID |
| `name` | TEXT | 버튼 이름 (예: "아내에게 전화") |
| `app_scheme` | TEXT | 실행할 URL Scheme |
| `icon_name` | TEXT | 아이콘 식별자 |
| `order_index` | INTEGER | 버튼 표시 순서 |

## [cite_start]4. 앱 권한 및 환경 설정 정책 [cite: 74]
* [cite_start]**위치 정보:** Background '항상 허용(Always Allow)' 필수. [cite: 78, 80]
* [cite_start]**알림:** 푸시 알림 허용. [cite: 81]
* [cite_start]**오버레이 (Android):** 다른 앱 위에 그리기 권한. [cite: 82]
* [cite_start]**배터리 최적화 예외 (Doze Mode):** 안드로이드 최적화 목록에서 '제외' 유도. [cite: 83, 84]

## [cite_start]5. 맵 엔진 설정 상세 (iOS Google Maps) [cite: 85]
* [cite_start]**요구사항:** iOS에서도 Apple Maps 대신 Google Maps 사용. [cite: 86]
* **구현 코드:**
    ```javascript
    import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
    <MapView
        provider={PROVIDER_GOOGLE} // 핵심 속성
        style={{ flex: 1 }}
        showsUserLocation={true}
    />
    ```
    [cite_start][cite: 88-95]

---

# [cite_start]PRD Part 2: UI/UX & Design System (TDS) [cite: 99]

[cite_start]**Design Philosophy:** "Extreme Simplicity" (복잡한 기술을 숨기고, 혜택만 남긴다) [cite: 103]

## [cite_start]1. 디자인 시스템 토큰 (Design Tokens) [cite: 104]
### [cite_start]1.1 Color Palette [cite: 106]
* [cite_start]**Primary:** `#3182F6` (Toss Blue) [cite: 107]
* [cite_start]**Background:** `#F2F4F6` (Light Warm Grey) [cite: 108]
* [cite_start]**Surface:** `#FFFFFF` (White) [cite: 109]
* [cite_start]**Text Strong:** `#191F28` [cite: 110]
* [cite_start]**Text Medium:** `#4E5968` [cite: 111]
* [cite_start]**Text Weak:** `#8B95A1` [cite: 112]
* [cite_start]**Error/Alert:** `#F04452` [cite: 113]

### [cite_start]1.2 Typography (Pretendard) [cite: 114]
* [cite_start]Display: 26px / Bold [cite: 115]
* [cite_start]Heading: 20px / Bold [cite: 116]
* [cite_start]Body: 16px / Medium [cite: 117]
* [cite_start]Caption: 13px / Regular [cite: 118]
* [cite_start]*Tip: 숫자는 Tabular Lining 적용.* [cite: 119]

### [cite_start]1.3 Layout [cite: 120]
* [cite_start]**Corner Radius:** 24px [cite: 121]
* [cite_start]**Spacing:** 8px 단위 (8, 16, 24, 48px) [cite: 122]
* [cite_start]**Shadow:** 0px 4px 20px rgba(0, 0, 0, 0.08) [cite: 123]

## [cite_start]2. 핵심 화면 흐름 (Screen Flow) [cite: 124]

### [cite_start]2.1 온보딩 (Permission Onboarding) [cite: 126]
* [cite_start]시스템 팝업 전, 설득 화면 우선 노출. [cite: 127]
* [cite_start]UI: 상단 Lottie 애니메이션 -> 중단 "도착 1km 전, 미리 깨워드릴게요" -> 하단 "시작하기" 버튼. [cite: 128-131]

### [cite_start]2.2 메인 홈 (Map & Search) [cite: 133]
* [cite_start]**Full Map:** 화면 전체 구글 맵. [cite: 136]
* [cite_start]**Floating Card:** 하단 BottomSheet 형태 검색창 ("어디로 갈까요?"). [cite: 138]
* [cite_start]**Interaction:** 지도 이동 시 중심 핀 Bounce 효과. [cite: 140]

### [cite_start]2.3 알람 설정 (Setup Flow) [cite: 141]
1.  [cite_start]**위치 확인:** 지도 중심 핀 확인. [cite: 143]
2.  [cite_start]**반경 설정:** 슬라이더 바로 조절 (실시간 원 크기 변화 + Haptic). [cite: 144-149]
3.  [cite_start]**메모 및 옵션:** 체크리스트/사진 아이콘 버튼. [cite: 151-153]

### [cite_start]2.4 알람 발생 (Trigger Screen) [cite: 155]
* [cite_start]**배경:** `#F04452` 혹은 그라데이션. [cite: 158]
* [cite_start]**중앙:** "목적지에 도착했어요!" [cite: 159]
* [cite_start]**액션:** "밀어서 알람 끄기" (Slide to Unlock). [cite: 160]

### [cite_start]2.5 도착 완료 & 커스텀 액션 (Post-Arrival) [cite: 162]
* **상단:** "안전하게 도착했습니다." (+체크리스트)[cite_start]. [cite: 165]
* [cite_start]**중단 (Custom Action Hub):** 미리 설정한 앱 아이콘(전화, 카톡, 지도 등) 노출 및 실행. [cite: 166-168]
* [cite_start]**하단 (Native Ad):** 광고 영역. [cite: 169]

## [cite_start]3. 수익화 및 개발 로드맵 [cite: 170, 181]
* [cite_start]**광고:** 도착 완료 화면 최하단 Native Ad 배치. [cite: 173, 174]
* **개발 우선순위:**
    1.  [cite_start]Project Init (Expo + TS) [cite: 183]
    2.  [cite_start]Asset Setup (Pretendard, Colors) [cite: 184]
    3.  [cite_start]Map Integration (Google Maps API) [cite: 185]
    4.  [cite_start]Permission Logic [cite: 186]

---

# [cite_start]PRD Part 3: Architecture, Flow & Detailed Screen Specs [cite: 190]

[cite_start]**Core Concept:** "Map-First, Action-Focused" [cite: 193]

## [cite_start]1. 앱 페이지 구조 (IA) [cite: 195]
1.  [cite_start]**스플래시:** 로고 및 로딩. [cite: 197]
2.  [cite_start]**메인 페이지 (Home):** 지도 중심 + 바텀 시트. [cite: 198]
3.  [cite_start]**알람 트리거 페이지:** 도착 시 전체 화면. [cite: 199]
4.  [cite_start]**설정 페이지:** 환경 설정 및 커스텀 스튜디오. [cite: 200]

## [cite_start]2. 상세 기능 [cite: 201]
* [cite_start]**메인 페이지:** Full-screen Map, Toss-style 검색바, 활성 알람 카드(남은 거리 표시), 배터리 세이빙 토글. [cite: 211-215]
* **알람 트리거 페이지:** 커스텀 배경/레이아웃 지원. [cite_start]A타입(상단 집중) / B타입(하단 집중). [cite: 220-222]
* [cite_start]**설정 페이지:** 지도 엔진 토글(구글/애플), 테마 설정, 알람 커스텀 스튜디오(미리보기 지원), 흔들어 끄기 On/Off. [cite: 229-234]

## [cite_start]3. 추가 아이디어 [cite: 246]
* [cite_start]**알람 미리보기:** 설정 시 진동/사운드 즉시 테스트. [cite: 247, 248]
* [cite_start]**도착 전 미리 알림:** 1km 전 푸시 알림으로 "곧 목적지 근처입니다" 발송. [cite: 249, 250]
* [cite_start]**위젯 (Widget):** 홈 화면에서 남은 거리 실시간 확인. [cite: 252, 253]
# 알람 트리거 화면 리디자인 + 완료 축하 + 전면광고 구현 지침서

## 개요
3개의 연결된 화면을 구현/개선한다:
1. **alarm-trigger.tsx** — 알람 울림 화면 리디자인 (시간표시 + 슬라이더 개선)
2. **alarm-completion.tsx** — 새 파일. 체크마크 축하 화면 (1.5초 자동 dismiss)
3. **interstitial-ad.tsx** — 새 파일. 전면 광고 화면 (목업 + 실제 API 연결 준비)

## 전체 플로우 변경

### 현재 플로우
```
alarm-trigger → (메모 있음) → action-checklist → router.replace('/(tabs)/home')
alarm-trigger → (메모 없음) → router.back()
```

### 변경 후 플로우
```
alarm-trigger → (메모 있음) → action-checklist → alarm-completion → interstitial-ad → router.replace('/(tabs)/home')
alarm-trigger → (메모 없음) → alarm-completion → interstitial-ad → router.replace('/(tabs)/home')
```

---

## Part 1: alarm-trigger.tsx 리디자인

### 1-A. 상단 시간/날짜 표시 추가

iOS 잠금화면 스타일의 시계를 화면 상단에 배치한다.

**레이아웃 구조:**
```
[SafeArea Top]
    ↓ 20pt
[현재 시간: "9:41" — 큰 글씨]
    ↓ 4pt
[현재 날짜: "2월 15일 토요일" — 작은 글씨]
    ↓ 8pt
[위치 아이콘 + 목적지 이름 — 더 작은 글씨]
    ↓ flex
[중앙: 리플 애니메이션 + 도착 뱃지]
    ↓ flex
[하단: 슬라이드 해제 슬라이더]
[SafeArea Bottom]
```

**시간 표시 스타일:**
```typescript
// 현재 시간 (실시간 업데이트 — 1분 간격)
timeText: {
    fontSize: 72,
    fontWeight: '700',  // Bold
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -2,  // 타이트한 자간
    fontVariant: ['tabular-nums'],
}

// 날짜
dateText: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
}

// 목적지 위치 정보
locationText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
}
```

**시간 실시간 업데이트 구현:**
```typescript
const [currentTime, setCurrentTime] = useState(new Date());

useEffect(() => {
    const timer = setInterval(() => {
        setCurrentTime(new Date());
    }, 60000); // 1분마다
    return () => clearInterval(timer);
}, []);

// 시간 포맷 (i18n 대응)
const timeString = currentTime.toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,  // 24시간 형식
});

const dateString = currentTime.toLocaleDateString(i18n.language, {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
});
```

**SafeArea 적용:**
- import `useSafeAreaInsets`
- 상단 시간 영역에 `paddingTop: insets.top + 20` 적용

### 1-B. 콘텐츠 영역 재구성

기존 `content` View의 구조를 변경:

**기존:**
```
content (flex:1, center) → ripple + arrivedBadge + heroTitle
```

**변경:**
```
topSection (상단 고정) → 시간 + 날짜 + 위치
centerSection (flex:1, center) → ripple + arrivedBadge (heroTitle 제거 — 위치 정보로 이동)
bottomSection (하단 고정) → 슬라이더
```

- `heroTitle`(64px 큰 텍스트) 제거. 목적지 이름은 상단 `locationText`에서 표시.
- "도착" 뱃지는 중앙 리플 애니메이션 위에 유지.
- 리플 원 중앙에 큰 위치 아이콘(Ionicons `location` 48px, white) 추가.

### 1-C. 슬라이더 리디자인

iOS 알람 앱 스타일의 세련된 슬라이더로 교체.

**슬라이더 트랙 변경:**
```typescript
sliderTrack: {
    width: '100%',
    height: 64,           // 기존 THUMB_WIDTH(64)와 동일
    borderRadius: 32,     // height / 2
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    // 테두리 제거 — 더 깔끔
    overflow: 'hidden',   // 내부 요소 클리핑
}
```

**썸(Thumb) 디자인 변경:**
```typescript
sliderThumb: {
    width: 56,            // 트랙보다 약간 작게
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',  // 순백색 (기존: colors.primary)
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 4,             // 트랙 내부 4pt 패딩
    // 그림자 추가
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
}
```

- 아이콘: `Ionicons name="arrow-forward"` size 24, color `colors.primary` (기존: chevron-forward white → 반전)

**애니메이션 추가 — 쉬머(shimmer) 화살표:**

트랙 안에 3개의 작은 chevron이 오른쪽으로 반복 슬라이드하는 애니메이션:

```typescript
// 쉬머 애니메이션 shared value
const shimmerProgress = useSharedValue(0);

useEffect(() => {
    shimmerProgress.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,  // 무한 반복
        false
    );
}, []);

// 3개 chevron의 animated style
const chevronStyle = (index: number) => useAnimatedStyle(() => {
    const baseX = 80 + index * 20;  // 썸 오른쪽에서 시작
    const translateX = interpolate(shimmerProgress.value, [0, 1], [0, 30]);
    const opacity = interpolate(shimmerProgress.value, [0, 0.3, 0.7, 1], [0.2, 0.6, 0.6, 0.2]);
    return {
        transform: [{ translateX: baseX + translateX }],
        opacity,
    };
});
```

렌더링:
```tsx
{/* 슬라이더 내부에 쉬머 chevron 3개 (썸 뒤에 렌더링) */}
{[0, 1, 2].map((i) => (
    <Animated.View key={i} style={[styles.shimmerChevron, chevronAnimStyle(i)]}>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
    </Animated.View>
))}
```

**라벨 위치 변경:**
- 기존: 트랙 중앙에 절대 배치
- 변경: 트랙 우측 40% 지점에 배치 (썸이 왼쪽에 있으므로)

**터치 피드백 추가:**
- 썸을 잡았을 때 110% 스케일 + opacity 0.9
- Pan gesture의 onStart에서 스케일 애니메이션 시작
- Pan gesture의 onEnd에서 스케일 복귀

```typescript
const thumbScale = useSharedValue(1);

// panGesture 수정
const panGesture = Gesture.Pan()
    .onStart(() => {
        thumbScale.value = withSpring(1.1, { damping: 15, stiffness: 300 });
    })
    .onUpdate(/* 기존 코드 */)
    .onEnd(() => {
        thumbScale.value = withSpring(1, { damping: 15, stiffness: 300 });
        // 기존 dismiss 로직
    });

// thumbAnimatedStyle 수정
const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
        { translateX: translateX.value },
        { scale: thumbScale.value },
    ],
}));
```

**Shake 힌트 스타일 변경:**
```typescript
shakeHint: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '400',
}
```

### 1-D. handleDismiss 플로우 변경

```typescript
const handleDismiss = useCallback(async () => {
    if (!activeAlarm) return;

    const alarmId = activeAlarm.id;
    const alarmTitle = activeAlarm.title;
    const hasMemos = currentMemos.length > 0;

    await stopSound();
    stopLoop();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await clearArrivalNotifications();
    await completeAlarm(alarmId);
    stopTracking();

    if (hasMemos) {
        // 체크리스트로 이동 (기존과 동일)
        router.replace({
            pathname: '/action-checklist',
            params: { alarmId: String(alarmId), alarmTitle },
        });
    } else {
        // ★ 변경: router.back() → alarm-completion으로 이동
        router.replace('/alarm-completion');
    }
}, [activeAlarm, currentMemos, completeAlarm, stopTracking, stopSound, stopLoop]);
```

### 1-E. i18n 키 추가

**ko.json `alarmTrigger` 섹션에 추가:**
```json
"alarmTrigger": {
    "arrived": "목적지에 도착했어요!",
    "arrivedBadge": "도착",
    "dismiss": "밀어서 해제",
    "dismissHint": "끝까지 밀어서 알람을 끄세요",
    "checklist": "할 일 목록",
    "shakeHint": "흔들어서 해제할 수 있어요"
}
```
- `dismiss` 텍스트를 "밀어서 알람 끄기" → "밀어서 해제"로 간결하게 변경

**en.json:**
```json
"alarmTrigger": {
    ...기존,
    "dismiss": "Slide to dismiss"
}
```
(이미 동일하므로 변경 불필요)

---

## Part 2: alarm-completion.tsx (새 파일)

### 파일 위치
`app/alarm-completion.tsx`

### 화면 설명
- 전체 화면, 짙은 배경
- 중앙에 큰 원형 체크마크 애니메이션
- 아래에 "알람이 종료되었습니다" 텍스트
- 1.5초 후 자동으로 다음 화면(전면광고)으로 이동
- 탭하면 즉시 이동 가능

### 레이아웃 구조
```
[전체 화면 — 짙은 배경]
    [중앙 정렬]
        [원형 컨테이너 (120x120)]
            [체크마크 아이콘 — 애니메이션]
        ↓ 24pt
        ["알람 완료!" — 큰 텍스트]
        ↓ 8pt
        ["목적지에 안전하게 도착했습니다" — 작은 텍스트]
```

### 체크마크 애니메이션 구현

Reanimated를 사용한 2단계 애니메이션:

```typescript
import Animated, {
    useSharedValue, useAnimatedStyle,
    withTiming, withSpring, withSequence, withDelay,
    Easing, runOnJS,
} from 'react-native-reanimated';

// Stage 1: 원 스케일 (0 → 1)
const circleScale = useSharedValue(0);
// Stage 2: 체크마크 스케일 (0 → 1.2 → 1)
const checkScale = useSharedValue(0);
// 전체 페이드
const screenOpacity = useSharedValue(1);

useEffect(() => {
    // 1. 원 등장 (0 → 1, 400ms, spring)
    circleScale.value = withSpring(1, { damping: 12, stiffness: 180 });

    // 2. 체크마크 등장 (200ms 딜레이 후, 0 → 1.15 → 1, spring)
    checkScale.value = withDelay(200,
        withSequence(
            withSpring(1.15, { damping: 8, stiffness: 200 }),
            withSpring(1, { damping: 14, stiffness: 200 }),
        )
    );

    // 3. 햅틱 피드백
    setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 300);

    // 4. 1.5초 후 자동 이동
    const timer = setTimeout(() => {
        navigateToAd();
    }, 1500);

    return () => clearTimeout(timer);
}, []);

const navigateToAd = useCallback(() => {
    router.replace('/interstitial-ad');
}, []);
```

### 원형 체크마크 스타일
```typescript
circleContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#00C853',  // colors.success
    justifyContent: 'center',
    alignItems: 'center',
    // 그림자
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
}
```

- 체크마크 아이콘: `Ionicons name="checkmark"` size 56, color `#FFFFFF`, strokeWidth 3

### 배경
```typescript
container: {
    flex: 1,
    backgroundColor: '#121212',  // ALARM_DARK_BG와 동일
    justifyContent: 'center',
    alignItems: 'center',
}
```

### Pressable 전체 화면 — 탭하면 즉시 이동
```tsx
<Pressable style={styles.container} onPress={navigateToAd}>
    {/* 체크마크 + 텍스트 */}
</Pressable>
```

### i18n 키 추가

**ko.json:**
```json
"alarmCompletion": {
    "title": "알람 완료!",
    "subtitle": "목적지에 안전하게 도착했습니다"
}
```

**en.json:**
```json
"alarmCompletion": {
    "title": "Alarm Complete!",
    "subtitle": "You've safely arrived at your destination"
}
```

**ja.json:**
```json
"alarmCompletion": {
    "title": "アラーム完了！",
    "subtitle": "目的地に無事到着しました"
}
```

---

## Part 3: interstitial-ad.tsx (새 파일)

### 파일 위치
`app/interstitial-ad.tsx`

### 설계 원칙
- 실제 `react-native-google-mobile-ads` 의 InterstitialAd API를 사용할 준비가 된 코드
- 광고 모듈이 없거나 로드 실패 시 → mockup UI 표시
- mockup도 "실제 전면 광고"처럼 보이도록 디자인
- 닫기 버튼은 5초 후 표시 (실제 광고와 동일한 패턴)

### 광고 로직 구조

```typescript
let InterstitialAd: any = null;
let AdEventType: any = null;
let TestIds: any = null;

try {
    const ads = require('react-native-google-mobile-ads');
    InterstitialAd = ads.InterstitialAd;
    AdEventType = ads.AdEventType;
    TestIds = ads.TestIds;
} catch {
    // Expo Go 등에서 네이티브 모듈 없음
}

// 실제 광고 ID (나중에 교체)
const AD_UNIT_ID = __DEV__
    ? TestIds?.INTERSTITIAL ?? 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyy'
    : 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyy';  // ← 프로덕션 ID 여기에 입력
```

### 화면 로직

```typescript
export default function InterstitialAdScreen() {
    const [adLoaded, setAdLoaded] = useState(false);
    const [adShown, setAdShown] = useState(false);
    const [showCloseButton, setShowCloseButton] = useState(false);
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        if (!InterstitialAd) {
            // 네이티브 모듈 없음 → mockup 모드
            startMockCountdown();
            return;
        }

        // 실제 광고 로드 시도
        const interstitial = InterstitialAd.createForAdRequest(AD_UNIT_ID);

        const loadListener = interstitial.addAdEventListener(AdEventType.LOADED, () => {
            setAdLoaded(true);
            interstitial.show();
        });

        const closeListener = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
            navigateHome();
        });

        const errorListener = interstitial.addAdEventListener(AdEventType.ERROR, () => {
            // 광고 로드 실패 → mockup으로 전환
            startMockCountdown();
        });

        interstitial.load();

        return () => {
            loadListener();
            closeListener();
            errorListener();
        };
    }, []);

    const startMockCountdown = () => {
        // 5초 카운트다운 후 닫기 버튼 표시
        let count = 5;
        const timer = setInterval(() => {
            count--;
            setCountdown(count);
            if (count <= 0) {
                clearInterval(timer);
                setShowCloseButton(true);
            }
        }, 1000);
    };

    const navigateHome = useCallback(() => {
        router.replace('/(tabs)/home');
    }, []);

    // 실제 광고가 로드되어 표시됐으면 빈 화면 (네이티브 광고가 위에 뜸)
    if (adLoaded || adShown) {
        return <View style={styles.container} />;
    }

    // Mockup 전면 광고 UI
    return <MockInterstitialAd countdown={countdown} showClose={showCloseButton} onClose={navigateHome} />;
}
```

### Mockup 전면 광고 UI

실제 전면 광고처럼 보이는 목업:

```tsx
function MockInterstitialAd({ countdown, showClose, onClose }) {
    return (
        <View style={styles.container}>
            {/* 상단: 닫기 버튼 또는 카운트다운 */}
            <SafeAreaView style={styles.topBar}>
                {showClose ? (
                    <Pressable style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close" size={24} color="#FFFFFF" />
                    </Pressable>
                ) : (
                    <View style={styles.countdownBadge}>
                        <Text style={styles.countdownText}>{countdown}</Text>
                    </View>
                )}
            </SafeAreaView>

            {/* 중앙: 광고 목업 이미지 영역 */}
            <View style={styles.adContent}>
                <View style={styles.adImagePlaceholder}>
                    <Ionicons name="megaphone-outline" size={64} color="rgba(255,255,255,0.3)" />
                    <Text style={styles.adPlaceholderText}>AD</Text>
                    <Text style={styles.adPlaceholderSub}>Sponsored Content</Text>
                </View>
            </View>

            {/* 하단: 광고 정보 */}
            <View style={styles.adFooter}>
                <Text style={styles.adFooterText}>광고 · Sponsored</Text>
            </View>
        </View>
    );
}
```

### Mockup 스타일
```typescript
container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
}

topBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
    padding: 16,
}

closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
}

countdownBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
}

countdownText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
}

adContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
}

adImagePlaceholder: {
    width: '80%',
    aspectRatio: 0.8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
}

adPlaceholderText: {
    fontSize: 32,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.2)',
    letterSpacing: 4,
    marginTop: 16,
}

adPlaceholderSub: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.15)',
    marginTop: 8,
}

adFooter: {
    paddingBottom: 40,
    alignItems: 'center',
}

adFooterText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
}
```

---

## Part 4: action-checklist.tsx 변경

### handleDone 함수 수정

**기존:**
```typescript
const handleDone = useCallback(async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)/home');
}, []);
```

**변경:**
```typescript
const handleDone = useCallback(async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // ★ 변경: home 대신 completion 화면으로
    router.replace('/alarm-completion');
}, []);
```

---

## Part 5: _layout.tsx 라우터 등록

### 새 화면 2개 등록

`<Stack>` 안에 추가:

```tsx
<Stack.Screen
    name="alarm-completion"
    options={{
        presentation: 'fullScreenModal',
        animation: 'fade',
        gestureEnabled: false,
    }}
/>
<Stack.Screen
    name="interstitial-ad"
    options={{
        presentation: 'fullScreenModal',
        animation: 'fade',
        gestureEnabled: false,
    }}
/>
```

`gestureEnabled: false` — 뒤로 스와이프 방지 (광고를 건너뛸 수 없도록)

---

## Part 6: i18n 전체 키 요약

### ko.json 추가/변경:
```json
"alarmTrigger": {
    "arrived": "목적지에 도착했어요!",
    "arrivedBadge": "도착",
    "dismiss": "밀어서 해제",
    "dismissHint": "끝까지 밀어서 알람을 끄세요",
    "checklist": "할 일 목록",
    "shakeHint": "흔들어서 해제할 수 있어요"
},
"alarmCompletion": {
    "title": "알람 완료!",
    "subtitle": "목적지에 안전하게 도착했습니다"
}
```

### en.json 추가:
```json
"alarmCompletion": {
    "title": "Alarm Complete!",
    "subtitle": "You've safely arrived at your destination"
}
```

### ja.json 추가:
```json
"alarmCompletion": {
    "title": "アラーム完了！",
    "subtitle": "目的地に無事到着しました"
}
```

---

## 검증 체크리스트

1. `npx tsc --noEmit` — TypeScript 에러 없음
2. alarm-trigger 화면:
   - 상단에 현재 시간/날짜 실시간 표시 확인
   - 목적지 이름이 시간 아래에 표시 확인
   - 슬라이더의 흰색 썸, 쉬머 애니메이션 확인
   - 슬라이드하면 썸 확대 효과 확인
   - 밀어서 해제하면 alarm-completion으로 이동 확인
3. alarm-completion 화면:
   - 체크마크 원이 스케일 애니메이션으로 등장 확인
   - 체크마크가 바운스 효과로 나타남 확인
   - 1.5초 후 자동으로 interstitial-ad로 이동 확인
   - 탭하면 즉시 이동 확인
4. interstitial-ad 화면:
   - 목업 UI가 전면 광고처럼 보이는지 확인
   - 카운트다운 5→0 정상 동작 확인
   - 카운트다운 완료 후 X 버튼 표시 확인
   - X 누르면 home으로 이동 확인
5. action-checklist → 완료 → alarm-completion → interstitial-ad → home 전체 플로우 확인
6. 메모 없는 알람 → alarm-trigger 해제 → alarm-completion → interstitial-ad → home 확인

## 주의사항

- `react-native-google-mobile-ads`는 이미 package.json에 설치됨. Expo Go에서는 네이티브 모듈 사용 불가하므로 try-catch로 감싸야 함
- alarm-completion은 빠르게 지나가는 화면이므로 무거운 애니메이션 피할 것 (Lottie 사용 금지 — Reanimated만 사용)
- interstitial-ad의 카운트다운은 실제 광고 연결 시 제거됨 (AdMob이 자체적으로 닫기 버튼 관리)
- `router.replace`를 사용하여 뒤로가기 스택이 쌓이지 않도록 함

# History 탭 CollapsibleSection 슬라이드 애니메이션 구현 지침서

## 목적
히스토리 탭의 날짜별 그룹이 접히고 펼쳐질 때, 부드러운 슬라이드 애니메이션을 적용한다.
- 펼칠 때: 콘텐츠가 위에서 아래로 슬라이드하며 나타남
- 접을 때: 콘텐츠가 아래에서 위로 슬라이드하며 사라짐
- 형제 섹션들이 자연스럽게 밀려나거나 올라옴
- 어떠한 딜레이나 렉도 없어야 함 (전부 UI 스레드에서 실행)

## 대상 파일
`app/(tabs)/history.tsx`

## 변경 사항

### 1. import 수정

기존 import 라인:
```typescript
import ReAnimated, { useAnimatedStyle, useSharedValue, withTiming, withSpring, interpolate, runOnJS } from 'react-native-reanimated';
```

변경:
```typescript
import ReAnimated, { useAnimatedStyle, useSharedValue, withTiming, withSpring, interpolate, runOnJS, FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';
```

추가 항목: `FadeInDown`, `FadeOutUp`, `LinearTransition`

### 2. `toggleSection` 함수에서 `LayoutAnimation` 제거

기존 코드:
```typescript
const toggleSection = useCallback((dateKey: string) => {
    LayoutAnimation.configureNext({
        duration: 250,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCollapsedSections((prev) => {
        const next = new Set(prev);
        if (next.has(dateKey)) {
            next.delete(dateKey);
        } else {
            next.add(dateKey);
        }
        return next;
    });
}, []);
```

변경 코드:
```typescript
const toggleSection = useCallback((dateKey: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCollapsedSections((prev) => {
        const next = new Set(prev);
        if (next.has(dateKey)) {
            next.delete(dateKey);
        } else {
            next.add(dateKey);
        }
        return next;
    });
}, []);
```

- `LayoutAnimation.configureNext(...)` 블록 전체 삭제
- Haptics와 setState는 그대로 유지

### 3. `CollapsibleSection` 컴포넌트 변경

기존 코드:
```tsx
function CollapsibleSection({ title, itemCount, isCollapsed, onToggle, children, colors, styles }: CollapsibleSectionProps) {
    return (
        <View style={styles.sectionContainer}>
            <Pressable style={styles.sectionHeader} onPress={onToggle}>
                <View style={styles.sectionHeaderLeft}>
                    <AnimatedChevron isCollapsed={isCollapsed} color={colors.textWeak} />
                    <Text style={styles.sectionHeaderText}>{title}</Text>
                </View>
                <Text style={styles.sectionHeaderCount}>{itemCount}</Text>
            </Pressable>

            {!isCollapsed && children}
        </View>
    );
}
```

변경 코드:
```tsx
function CollapsibleSection({ title, itemCount, isCollapsed, onToggle, children, colors, styles }: CollapsibleSectionProps) {
    return (
        <ReAnimated.View style={styles.sectionContainer} layout={LinearTransition.duration(250)}>
            <Pressable style={styles.sectionHeader} onPress={onToggle}>
                <View style={styles.sectionHeaderLeft}>
                    <AnimatedChevron isCollapsed={isCollapsed} color={colors.textWeak} />
                    <Text style={styles.sectionHeaderText}>{title}</Text>
                </View>
                <Text style={styles.sectionHeaderCount}>{itemCount}</Text>
            </Pressable>

            {!isCollapsed && (
                <ReAnimated.View
                    entering={FadeInDown.duration(300).damping(18).stiffness(200)}
                    exiting={FadeOutUp.duration(200)}
                >
                    {children}
                </ReAnimated.View>
            )}
        </ReAnimated.View>
    );
}
```

변경 포인트:
- 최외곽 `View` → `ReAnimated.View` + `layout={LinearTransition.duration(250)}` (형제 섹션 재배치 애니메이션)
- children 래퍼: `ReAnimated.View` + `entering={FadeInDown}` + `exiting={FadeOutUp}`
- `FadeInDown`: 콘텐츠가 약간 위에서 시작하여 최종 위치로 슬라이드하면서 페이드인
- `FadeOutUp`: 콘텐츠가 위쪽으로 슬라이드하면서 페이드아웃
- duration 300ms (entering) / 200ms (exiting) — 접을 때가 약간 빨라서 쾌적한 느낌

### 4. 불필요한 import 정리 (선택)

`LayoutAnimation`과 `UIManager`가 더 이상 이 파일에서 사용되지 않으면 import에서 제거:

기존:
```typescript
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Alert, ActivityIndicator, LayoutAnimation, UIManager, Platform } from 'react-native';
```

변경:
```typescript
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Alert, ActivityIndicator, Platform } from 'react-native';
```

그리고 파일 상단의 Android LayoutAnimation 설정도 제거:
```typescript
// 아래 블록 삭제
if (Platform.OS === 'android') {
    UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
```

**주의**: `Platform`은 다른 곳에서 쓰일 수 있으니 확인 후 제거. 이 파일에서 Platform을 다른 곳에서 사용하지 않으면 함께 제거.

### 5. 애니메이션 파라미터 튜닝 가이드

만약 기본값이 마음에 들지 않을 경우 조정할 수 있는 부분:

```typescript
// 더 빠른 진입
entering={FadeInDown.duration(200)}

// 스프링 느낌 강화
entering={FadeInDown.springify().damping(14).stiffness(150)}

// 순수 슬라이드 (페이드 없이) — SlideInDown / SlideOutUp 사용
// 단, 이 경우 import를 SlideInDown, SlideOutUp으로 변경
entering={SlideInDown.duration(300)}
exiting={SlideOutUp.duration(200)}
```

## 검증 방법
1. `npx tsc --noEmit` — TypeScript 에러 없음 확인
2. iOS 시뮬레이터에서 히스토리 탭 진입
3. 날짜 그룹 헤더 탭하여 접기/펼치기 반복
4. 애니메이션이 스무스하게 슬라이드되는지 확인
5. 한 섹션을 펼칠 때 아래 섹션들이 자연스럽게 밀려나는지 확인
6. 빠르게 연속 탭해도 렉이나 깨짐 없는지 확인

## 주의사항
- `LayoutAnimation`과 Reanimated Layout Animation을 동시에 사용하면 충돌 가능 → 반드시 `LayoutAnimation.configureNext()` 제거
- `FadeInDown`의 `damping`/`stiffness`는 `.springify()` 호출 후에만 유효. duration 기반으로 쓸 때는 `.duration(ms)`만 사용
- `LinearTransition`은 형제 요소들의 위치 변경을 부드럽게 처리하는 핵심 — 빠뜨리면 아래 섹션이 갑자기 점프함

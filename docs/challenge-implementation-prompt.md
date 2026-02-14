# Challenge Feature Implementation Prompt

## ⚠️ CRITICAL: WORKING DIRECTORY RULES

**YOU MUST WORK INSIDE THE EXISTING PROJECT. DO NOT CREATE A NEW PROJECT.**

- The project root is the current directory where this file lives: the `locationAlarm/` folder.
- All files listed below are **relative paths from this project root**.
- **DO NOT** create a new folder, workspace, worktree, or project scaffold.
- **DO NOT** run `npx create-expo-app`, `npm init`, or any project initialization command.
- **DO NOT** create anything under `.claude/worktrees/`.
- The project already has `node_modules/`, `package.json`, `app/`, `src/`, etc. fully set up and working.
- You are **modifying and extending an existing, running app** — not starting from scratch.
- Before making any changes, run `ls` in the project root to confirm you see: `app/`, `src/`, `package.json`, `CLAUDE.md`, `docs/`, `node_modules/`, etc.
- Read `CLAUDE.md` at the project root for architecture overview, coding standards, and patterns to follow.
- Read `docs/챌린지_기획정리.md` for the full design spec in Korean. It is the single source of truth. If anything in this prompt conflicts with that doc, the Korean doc takes precedence.

---

## What This Task Is

You are adding a **Challenge feature** to the existing LocaAlert app. This replaces the current "Routines" feature. A challenge is a **location-based visit goal** — the user picks a place, sets a weekly visit target, and the app automatically tracks attendance via geofencing.

### Existing Tech Stack (DO NOT change or reinstall)
- React Native (Expo) — already configured
- Zustand — state management
- SQLite (expo-sqlite) — local DB
- expo-location + expo-task-manager — background geolocation
- react-native-maps — Google Maps on both platforms
- expo-haptics, lottie-react-native — UX feedback
- react-i18next — i18n (ko, en, ja)
- Emotion (styled-components) — styling
- Design system: Toss-style (Primary `#3182F6`, Pretendard font)

---

## File Operations

### DELETE these files (routine removal):
- `app/(tabs)/routines.tsx`
- `app/routine-setup.tsx`
- `src/stores/routineStore.ts`

### MODIFY these existing files:
- `app/(tabs)/_layout.tsx` — Replace "Routines" tab with "Challenge" tab
- `app/challenge-landing.tsx` — Already exists as a stub, rebuild entirely
- `app/challenge-create.tsx` — Already exists as a stub, rebuild entirely
- `app/(tabs)/activity.tsx` — Update to show challenge history
- `src/i18n/locales/ko.json` — Remove routine keys, add challenge keys
- `src/i18n/locales/en.json` — Remove routine keys, add challenge keys
- `src/i18n/locales/ja.json` — Remove routine keys, add challenge keys
- `src/db/schema.ts` — Add challenges and visit_records tables

### CREATE these new files (inside existing directories):
- `src/stores/challengeStore.ts` — Core challenge state & logic
- `src/stores/devStore.ts` — Dev-only debug tools (wrap with `__DEV__`)
- `app/challenge-detail.tsx` — Challenge detail/history screen
- `app/dev-debug.tsx` — Developer debug panel screen
- `src/components/challenge/` — Challenge-specific UI components (cards, progress, graduation)

**All new files go into existing `src/` and `app/` directories. Do NOT create new top-level folders.**

---

## 1. Data Model

### Challenge Entity

```typescript
interface Challenge {
  id: string;
  name: string;                    // Custom name (optional, user input)
  icon: ChallengeIcon;             // 'fitness' | 'walk' | 'book' | 'cafe' | 'bicycle'

  // Location
  latitude: number;
  longitude: number;
  radius: number;                  // meters (reuse alarm radius logic)
  placeName: string;               // Display name of the place

  // Weekly goal
  weeklyGoal: number;              // 1~7 (stepper)

  // Day-specific mode
  daySpecific: boolean;            // false = any day counts, true = only specified days
  days: DayOfWeek[];               // Only when daySpecific is true
                                   // CONSTRAINT: days.length MUST equal weeklyGoal

  // Duration
  durationWeeks: number;           // 1~8 (1-week increments, max 2 months)
  repeatMode: boolean;             // true = auto-restart cycle after completion

  // Dwell time verification (optional)
  dwellTimeEnabled: boolean;       // false by default
  dwellTimeMinutes: number | null; // 15 | 30 | 60 | 120 (preset only, no free input)

  // Progress tracking
  currentWeek: number;             // 1-indexed
  weeklyVisits: number;            // Visits counted this week
  combo: number;                   // Consecutive weeks of goal completion
  chances: number;                 // Defense tokens (starts at 1, +1 at every 3-combo)

  // State
  status: 'active' | 'graduated' | 'failed';
  createdAt: string;
  graduatedAt: string | null;
}

type ChallengeIcon = 'fitness' | 'walk' | 'book' | 'cafe' | 'bicycle';
type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
```

### Visit Record Entity

```typescript
interface VisitRecord {
  id: string;
  challengeId: string;
  enteredAt: string;               // ISO timestamp
  exitedAt: string | null;         // null if still inside
  dwellMinutes: number | null;
  counted: boolean;                // Whether this visit counted toward the goal
  dayOfWeek: DayOfWeek;
  week: number;                    // Which week of the challenge
}
```

### SQLite Schema (add to existing `src/db/schema.ts`)

```sql
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  name TEXT,
  icon TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius INTEGER NOT NULL,
  place_name TEXT NOT NULL,
  weekly_goal INTEGER NOT NULL,
  day_specific INTEGER NOT NULL DEFAULT 0,
  days TEXT,
  duration_weeks INTEGER NOT NULL,
  repeat_mode INTEGER NOT NULL DEFAULT 0,
  dwell_time_enabled INTEGER NOT NULL DEFAULT 0,
  dwell_time_minutes INTEGER,
  current_week INTEGER NOT NULL DEFAULT 1,
  weekly_visits INTEGER NOT NULL DEFAULT 0,
  combo INTEGER NOT NULL DEFAULT 0,
  chances INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  graduated_at TEXT
);

CREATE TABLE IF NOT EXISTS visit_records (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  entered_at TEXT NOT NULL,
  exited_at TEXT,
  dwell_minutes REAL,
  counted INTEGER NOT NULL DEFAULT 0,
  day_of_week TEXT NOT NULL,
  week INTEGER NOT NULL,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);
```

---

## 2. Core Logic (challengeStore.ts)

Follow existing Zustand store patterns in `src/stores/alarmStore.ts`.

### Simultaneous Challenge Limit
- Maximum **2 active challenges** at any time.
- 3rd creation attempt → show message: "Complete a current challenge to start a new one."

### Visit Recording (`recordVisit`)

When user enters a challenge geofence:

1. **Day-specific check:** If `daySpecific === true`, check today is in `days` array. If not → reject.
2. **Dwell time check:** If `dwellTimeEnabled === true`, don't count immediately. Start tracking. Only count when `dwellMinutes >= dwellTimeMinutes`.
3. **Duplicate check:** Max 1 counted visit per day per challenge. If already counted today → reject.
4. All checks pass → increment `weeklyVisits`, create `VisitRecord` with `counted: true`.

### Weekly Completion (`checkWeeklyCompletion`)

At end of each week (or when final required visit is recorded):

- `weeklyVisits >= weeklyGoal`:
  - `combo += 1`
  - If `combo % 3 === 0` → `chances += 1` (bonus defense token)
  - Trigger micro reward (haptic + animation + message)
- `weeklyVisits < weeklyGoal`:
  - `chances > 0` → `chances -= 1`, combo preserved
  - `chances === 0` → `combo = 0` (reset)
- Reset `weeklyVisits = 0`, `currentWeek += 1`

### Graduation

After weekly completion, if `currentWeek > durationWeeks`:
- `repeatMode === true` → reset `currentWeek = 1`, keep combo, new cycle
- `repeatMode === false` → `status = 'graduated'`, record `graduatedAt`

### Card Tier (visual only)

| Combo | Visual |
|-------|--------|
| 1 | Default card |
| 3 | Silver border + "Staying consistent" badge |
| 5 | Gold border + "Habit master" badge |
| 10 | Special effect |

### Micro Rewards (weekly completion)
- `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`
- Check animation (Lottie)
- One-line congratulation message
- Keep minimal

---

## 3. Dwell Time Verification

### Flow
```
Enter geofence → auto-start timer → exit geofence → stop timer → check >= minimum
```

### Edge Cases

**GPS Jitter (2-layer filter):**
1. Accuracy filter: Ignore location updates with GPS accuracy > 50m for exit determination.
2. Grace period: On valid exit, wait **3 minutes** before confirming. Re-entry within 3min → timer continues.

**Phone in Locker:**
- Last valid location inside geofence + no updates for extended period → treat as still inside.
- Absence of exit event = continued presence.

**Battery Death / App Kill:**
- On geofence entry, write `entered_at` to SQLite immediately.
- On app restart: current location inside geofence → retroactively count from `entered_at`. Outside → don't count.

### User Feedback
- Notification bar: "Gym — 23min / 30min"
- Minimum reached → push: "Attendance complete!"
- Challenge card shows dwell badge

---

## 4. Day-Specific Mode

### Default (daySpecific: false)
- "Gym 3x/week" → any 3 visits Mon-Sun count. Recommended default.

### Day-Specific (daySpecific: true)
- "Gym 3x/week Mon/Wed/Fri" → only those days count.
- **STRICT CONSTRAINT:** `days.length` MUST equal `weeklyGoal`. Enforce in UI — disable create button if mismatched.
- UI: 7 day chips (Mon~Sun) below weekly goal stepper, tap to toggle.

| Mode | Visit on Tuesday (Mon/Wed/Fri challenge, goal=3) |
|------|--------------------------------------------------|
| OFF | ✅ Counted |
| ON | ❌ Not counted |

---

## 5. Challenge Landing Page (`challenge-landing.tsx`)

**This file already exists. Rebuild its contents entirely.**

### State 1: No Active Challenges (First Visit)
- Top: Empathetic one-liner (first visit only). Warm, encouraging tone.
- Middle: Recommended challenge templates (cards). Location-specific: "Gym 3x/week", "Library 5x/week"
- Bottom: "Create My Own Challenge" button → `challenge-create`

### State 2: Active Challenge(s)
- Top section hidden
- Active challenge card(s) prominent at top
  - Progress: "Just 2 more this week!" (motivational framing)
  - D-day badge
  - Tap → challenge detail
- Bottom: Recommended + "Add new" (only if < 2 active)

### State 3: Graduated
- Celebration + result summary
- "Try Again" / "Start New" CTAs
- History preserved

---

## 6. Challenge Create Page (`challenge-create.tsx`)

**This file already exists. Rebuild its contents entirely.**

Single scrollable page:

1. **Place Selection** — Reuse existing location picker flow from home tab
2. **Icon** — 5 horizontal chips (fitness, walk, book, cafe, bicycle)
3. **Name** — Optional text field. Default: place name
4. **Weekly Goal** — Stepper 1~7. Default: 3
5. **Day-Specific Toggle** — OFF default. ON → show 7 day chips. Enforce count = weekly goal
6. **Duration** — Stepper 1~8 weeks. Default: 3
7. **Repeat Mode Toggle** — OFF default
8. **Dwell Time Toggle** — OFF default. ON → preset chips: 15min / 30min / 1hr / 2hr
9. **Create Button** — Validate all, create in store + SQLite, navigate to landing

---

## 7. Combo & Chance System

- New challenge starts with **1 chance**
- Every **3rd combo** (3, 6, 9, 12...) → +1 chance
- Weekly fail + chances > 0 → chance consumed, combo safe
- Weekly fail + chances === 0 → combo resets to 0
- Design principle: "Soft landing on failure > more rewards on success"

---

## 8. Testing Strategy

### 8A. Developer Debug Panel

- Entry: Settings screen → tap version text **5 times**
- Wrap with `__DEV__` — removed in production
- Features:
  - Visit simulator: tap to record visit without GPS
  - Time jump: offset `getEffectiveNow()` via `devStore.timeOffsetDays`
  - State override: set combo/chances/week directly

```typescript
// src/stores/devStore.ts
interface DevStore {
  timeOffsetDays: number;
  setTimeOffset: (days: number) => void;
}

function getEffectiveNow(): Date {
  const now = new Date();
  if (__DEV__) {
    now.setDate(now.getDate() + useDevStore.getState().timeOffsetDays);
  }
  return now;
}
```

### 8B. Unit Tests (Jest)

Test pure logic in `challengeStore` — attendance judgment, combo/chance calculation, graduation/repeat.

See `docs/챌린지_기획정리.md` section 6 for full test case examples including:
- Day-specific ON/OFF attendance
- Dwell time met/not met
- Combo increment, chance consumption, combo reset
- 3-combo bonus chance
- Graduation trigger, repeat mode cycle restart

---

## 9. i18n

Add challenge keys to `src/i18n/locales/ko.json`, `en.json`, `ja.json`.
Remove all routine-related keys from all three files.

Key areas: landing messages, create form labels, combo/chance messages, graduation, day names, dwell labels, validation errors.

---

## 10. Implementation Order

1. **Verify environment:** `ls` the project root. Confirm existing structure.
2. **Data layer:** Add SQLite tables in `src/db/schema.ts` + create `src/stores/challengeStore.ts`
3. **Unit tests:** Jest tests for all pure logic
4. **Delete routines:** Remove routine files, update tab layout in `app/(tabs)/_layout.tsx`
5. **Challenge create page:** Rebuild `app/challenge-create.tsx`
6. **Challenge landing page:** Rebuild `app/challenge-landing.tsx` with 3 states
7. **Challenge detail page:** Create `app/challenge-detail.tsx`
8. **Geofence integration:** Connect existing location tracking to visit recording
9. **Dwell time:** Layer on geofence logic
10. **Dev debug panel:** `devStore.ts` + `app/dev-debug.tsx`
11. **i18n:** All three languages
12. **Polish:** Haptics, animations, card tiers

---

## Hard Rules

- **DO NOT create a new project.** Work in the existing codebase.
- **Max 2 active challenges** at any time.
- **Day-specific:** day count MUST equal weekly goal. No exceptions.
- **Dwell time presets only:** 15 / 30 / 60 / 120 minutes. No free input.
- **Chances start at 1**, +1 at every 3-combo.
- **Repeat mode** preserves combo across cycles.
- **Soft failure design:** prevent dropout > add rewards.
- **Location-first:** every challenge tied to a place. No generic challenges.
- Follow patterns in `CLAUDE.md` (Zustand, Expo Router, Emotion, Toss design).
- Communicate with user in **Korean**. Internal reasoning in **English**.

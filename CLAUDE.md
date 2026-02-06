# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LocaAlert is a location-based alarm app built with React Native and Expo. It triggers alarms when users approach a set destination, using background location tracking with a smart interval algorithm to balance accuracy and battery life.

## Commands

```bash
npm start          # Start Expo dev server
npm run ios        # iOS simulator
npm run android    # Android emulator
npm run web        # Web browser (limited functionality)
```

No test framework is currently configured.

## Architecture

### File-Based Routing (Expo Router)

```
app/
├── _layout.tsx              # Root layout with DB initialization
├── index.tsx                # Entry router (onboarding check)
├── onboarding.tsx           # Permission request flow
├── alarm-setup.tsx          # Alarm configuration screen
├── alarm-trigger.tsx        # Full-screen alarm modal
├── favorite-place-setup.tsx # Favorite place editor
└── (tabs)/                  # Tab navigation group
    ├── home.tsx             # Main map + location picker
    ├── history.tsx          # Alarm history
    └── settings.tsx         # Language, theme settings
```

### State Management (Zustand)

- **alarmStore** - Alarm CRUD, active alarm tracking, action memos
- **locationStore** - GPS tracking, geofencing, navigation state, transport modes
- **themeStore** - Dark/light/system mode (persisted to AsyncStorage)
- **favoritePlaceStore** - Up to 3 saved locations (persisted to AsyncStorage)

### Data Persistence

SQLite database (`src/db/`) stores alarms, action memos, and custom actions. AsyncStorage handles user preferences (theme, favorites, onboarding status).

### Key Services

- `src/services/location/locationService.ts` - Background location tracking via expo-task-manager
- `src/services/location/geofence.ts` - Haversine distance calculations
- `src/services/geocoding.ts` - Reverse geocoding with coordinate-based caching
- `src/services/placeSearch.ts` - Google Places Autocomplete integration

### Smart Interval Algorithm

Location polling frequency adjusts based on distance to target:
- `>10km` → 10 min interval
- `2-10km` → 3 min interval
- `1-2km` → 1 min interval
- `<1km` → Real-time with 10m distance filter

Implementation in `locationStore.ts` (calculatePhase, getCheckInterval).

## Key Patterns

### Theming

Use `useThemeColors()` hook for current color palette. Theme follows Toss design system with primary blue `#3182F6`. Design tokens in `src/styles/theme.ts`.

### Internationalization

Three languages: Korean (ko), English (en), Japanese (ja). Korean is the fallback.

```typescript
const { t, i18n } = useTranslation();
t('key.path')                  // Get translation
i18n.changeLanguage('en')      // Switch language
```

Translation files in `src/i18n/locales/`.

### Navigation

```typescript
import { router } from 'expo-router';
router.push('/alarm-setup?latitude=37.123&longitude=126.456');
router.back();
```

### Store Access

```typescript
// In React components
const { alarms, createAlarm } = useAlarmStore();

// Outside React
const state = useAlarmStore.getState();
```

## Important Notes

- Background location permission is critical for the core feature
- Google Maps is locked as the map provider on both iOS and Android
- Geocoding cache uses 5 decimal place precision (~1m accuracy)
- Expo Go has limitations with background permissions; use dev builds for full testing

## Agent Guidelines

- **Reasoning & Thought Process:** Must be conducted in **English**.
- **User Communication:** Final briefings and responses to the user must be in **Korean**.

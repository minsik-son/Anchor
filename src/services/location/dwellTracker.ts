/**
 * Dwell Tracker - GPS jitter-aware dwell time tracking for challenges
 *
 * Two-layer GPS jitter filter:
 *   1. Accuracy > 50m data is ignored for exit detection
 *   2. Valid exit triggers a 3-minute grace period (re-entry resets timer)
 *
 * Phone lock: absence of exit event = continued dwell
 * Battery death: entered_at is persisted immediately; app restart triggers retroactive check
 */

import { isWithinRadius, Coordinate } from './geofence';
import { useChallengeStore } from '../../stores/challengeStore';
import { ChallengeRow } from '../../db/schema';

const ACCURACY_THRESHOLD_METERS = 50;
const GRACE_PERIOD_MS = 3 * 60 * 1000; // 3 minutes
const DEFAULT_RADIUS_METERS = 200;

interface DwellState {
    challengeId: string;
    isInside: boolean;
    enteredAt: number | null;
    graceTimerId: ReturnType<typeof setTimeout> | null;
    lastValidLocation: Coordinate | null;
}

const dwellStates = new Map<string, DwellState>();

/**
 * Initialize dwell tracking for a challenge
 */
export function startDwellTracking(challenge: ChallengeRow): void {
    if (dwellStates.has(challenge.id)) return;

    dwellStates.set(challenge.id, {
        challengeId: challenge.id,
        isInside: false,
        enteredAt: null,
        graceTimerId: null,
        lastValidLocation: null,
    });
}

/**
 * Stop dwell tracking for a challenge
 */
export function stopDwellTracking(challengeId: string): void {
    const state = dwellStates.get(challengeId);
    if (state?.graceTimerId) {
        clearTimeout(state.graceTimerId);
    }
    dwellStates.delete(challengeId);
}

/**
 * Process a location update for all tracked challenges.
 * Called from the background location task on each update.
 */
export function processLocationUpdate(
    location: Coordinate & { accuracy?: number },
    activeChallenges: ChallengeRow[],
): void {
    for (const challenge of activeChallenges) {
        if (!dwellStates.has(challenge.id)) {
            startDwellTracking(challenge);
        }

        const state = dwellStates.get(challenge.id)!;
        const challengeCenter: Coordinate = {
            latitude: challenge.latitude,
            longitude: challenge.longitude,
        };
        const radius = challenge.radius ?? DEFAULT_RADIUS_METERS;
        const inside = isWithinRadius(location, challengeCenter, radius);

        // Filter 1: Ignore low-accuracy readings for exit detection
        const isHighAccuracy = !location.accuracy || location.accuracy <= ACCURACY_THRESHOLD_METERS;

        if (inside) {
            handleEntry(state, challenge);
        } else if (isHighAccuracy) {
            handleExit(state, challenge);
        }
        // Low accuracy + outside → ignore (could be GPS jitter)

        if (isHighAccuracy) {
            state.lastValidLocation = { latitude: location.latitude, longitude: location.longitude };
        }
    }
}

/**
 * Handle geofence entry
 */
function handleEntry(state: DwellState, challenge: ChallengeRow): void {
    // Cancel grace period if re-entering during grace window
    if (state.graceTimerId) {
        clearTimeout(state.graceTimerId);
        state.graceTimerId = null;
    }

    if (!state.isInside) {
        state.isInside = true;
        state.enteredAt = Date.now();

        // Start dwell session (persists entered_at immediately for crash recovery)
        useChallengeStore.getState().startDwellSession(challenge.id);
    }
}

/**
 * Handle geofence exit with grace period
 */
function handleExit(state: DwellState, challenge: ChallengeRow): void {
    if (!state.isInside) return;

    // Filter 2: Start grace period instead of immediate exit
    if (!state.graceTimerId) {
        state.graceTimerId = setTimeout(() => {
            confirmExit(state, challenge);
        }, GRACE_PERIOD_MS);
    }
}

/**
 * Confirm exit after grace period expires
 */
function confirmExit(state: DwellState, challenge: ChallengeRow): void {
    state.graceTimerId = null;

    if (!state.isInside || !state.enteredAt) return;

    const dwellMs = Date.now() - state.enteredAt;
    const dwellMinutes = dwellMs / (1000 * 60);

    state.isInside = false;
    state.enteredAt = null;

    useChallengeStore.getState().endDwellSession(challenge.id, dwellMinutes);
}

/**
 * Clean up all dwell tracking states
 */
export function stopAllDwellTracking(): void {
    for (const [, state] of dwellStates) {
        if (state.graceTimerId) {
            clearTimeout(state.graceTimerId);
        }
    }
    dwellStates.clear();
}

/**
 * Check if currently inside a challenge geofence
 */
export function isInsideChallenge(challengeId: string): boolean {
    return dwellStates.get(challengeId)?.isInside ?? false;
}

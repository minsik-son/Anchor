/**
 * Challenge Store - Zustand state management for challenges
 * Handles CRUD, visit recording, combo/chance system, graduation logic
 */

import { create } from 'zustand';
import { ChallengeRow, VisitRecordRow, CreateChallengeInput, DayOfWeek } from '../db/schema';
import * as db from '../db/database';
import { getEffectiveNow } from './devStore';

const MAX_ACTIVE_CHALLENGES = 2;

const DAY_INDEX_TO_DOW: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface DwellSession {
    challengeId: string;
    visitRecordId: string;
    enteredAt: Date;
}

interface ChallengeState {
    challenges: ChallengeRow[];
    activeChallenges: ChallengeRow[];
    isLoading: boolean;
    error: string | null;
    dwellSessions: Map<string, DwellSession>;

    // CRUD
    loadChallenges: () => Promise<void>;
    createChallenge: (input: CreateChallengeInput) => Promise<string>;
    updateChallenge: (id: string, updates: Parameters<typeof db.updateChallenge>[1]) => Promise<void>;
    deleteChallenge: (id: string) => Promise<void>;
    canCreateChallenge: () => boolean;

    // Visit recording
    recordVisit: (challengeId: string, dwellMinutes?: number) => Promise<{ counted: boolean; reason?: string }>;

    // Weekly lifecycle
    checkWeeklyCompletion: (challengeId: string) => Promise<{
        completed: boolean;
        comboChange?: number;
        chanceUsed?: boolean;
        graduated?: boolean;
        bonusChance?: boolean;
    }>;
    advanceWeek: (challengeId: string) => Promise<void>;

    // Dwell session
    startDwellSession: (challengeId: string) => Promise<void>;
    endDwellSession: (challengeId: string, dwellMinutes: number) => Promise<void>;

    // Debug (dev only)
    forceUpdateState: (challengeId: string, updates: Parameters<typeof db.updateChallenge>[1]) => Promise<void>;

    clearError: () => void;
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
    challenges: [],
    activeChallenges: [],
    isLoading: false,
    error: null,
    dwellSessions: new Map(),

    loadChallenges: async () => {
        set({ isLoading: true, error: null });
        try {
            const [challenges, activeChallenges] = await Promise.all([
                db.getAllChallenges(),
                db.getActiveChallenges(),
            ]);
            set({ challenges, activeChallenges, isLoading: false });
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    createChallenge: async (input) => {
        if (!get().canCreateChallenge()) {
            throw new Error('MAX_ACTIVE_LIMIT');
        }
        set({ isLoading: true, error: null });
        try {
            const id = await db.createChallenge(input);
            await get().loadChallenges();
            return id;
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
            throw error;
        }
    },

    updateChallenge: async (id, updates) => {
        try {
            await db.updateChallenge(id, updates);
            await get().loadChallenges();
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    deleteChallenge: async (id) => {
        try {
            await db.deleteChallenge(id);
            const sessions = new Map(get().dwellSessions);
            sessions.delete(id);
            set({ dwellSessions: sessions });
            await get().loadChallenges();
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    canCreateChallenge: () => {
        return get().activeChallenges.length < MAX_ACTIVE_CHALLENGES;
    },

    recordVisit: async (challengeId, dwellMinutes) => {
        const challenge = await db.getChallengeById(challengeId);
        if (!challenge || challenge.status !== 'active') {
            return { counted: false, reason: 'INACTIVE' };
        }

        const now = getEffectiveNow();
        const todayDow = getDayOfWeek(now);

        // Day-specific check
        if (challenge.day_specific && challenge.days) {
            if (!challenge.days.includes(todayDow)) {
                // Record visit but don't count
                await db.createVisitRecord({
                    challenge_id: challengeId,
                    entered_at: now.toISOString(),
                    dwell_minutes: dwellMinutes ?? null,
                    counted: false,
                    day_of_week: todayDow,
                    week: challenge.current_week,
                });
                return { counted: false, reason: 'WRONG_DAY' };
            }
        }

        // Dwell time check
        if (challenge.dwell_time_enabled && challenge.dwell_time_minutes) {
            if (!dwellMinutes || dwellMinutes < challenge.dwell_time_minutes) {
                await db.createVisitRecord({
                    challenge_id: challengeId,
                    entered_at: now.toISOString(),
                    dwell_minutes: dwellMinutes ?? null,
                    counted: false,
                    day_of_week: todayDow,
                    week: challenge.current_week,
                });
                return { counted: false, reason: 'DWELL_TIME_NOT_MET' };
            }
        }

        // Duplicate check (max 1 counted visit per day)
        const todayCount = await db.getCountedVisitsToday(challengeId, now.toISOString());
        if (todayCount > 0) {
            return { counted: false, reason: 'ALREADY_COUNTED_TODAY' };
        }

        // All checks pass — count the visit
        await db.createVisitRecord({
            challenge_id: challengeId,
            entered_at: now.toISOString(),
            dwell_minutes: dwellMinutes ?? null,
            counted: true,
            day_of_week: todayDow,
            week: challenge.current_week,
        });

        const newWeeklyVisits = challenge.weekly_visits + 1;
        await db.updateChallenge(challengeId, { weekly_visits: newWeeklyVisits });

        // Auto-check weekly completion when goal is met
        if (newWeeklyVisits >= challenge.weekly_goal) {
            const result = await get().checkWeeklyCompletion(challengeId);
            await get().loadChallenges();
            return { counted: true, ...result };
        }

        await get().loadChallenges();
        return { counted: true };
    },

    checkWeeklyCompletion: async (challengeId) => {
        const challenge = await db.getChallengeById(challengeId);
        if (!challenge) return { completed: false };

        const goalMet = challenge.weekly_visits >= challenge.weekly_goal;

        if (goalMet) {
            const newCombo = challenge.combo + 1;
            const bonusChance = newCombo % 3 === 0;
            const newChances = bonusChance ? challenge.chances + 1 : challenge.chances;

            await db.updateChallenge(challengeId, {
                combo: newCombo,
                chances: newChances,
            });

            // Check graduation
            const nextWeek = challenge.current_week + 1;
            if (nextWeek > challenge.duration_weeks) {
                if (challenge.repeat_mode) {
                    // Repeat: reset week, keep combo
                    await db.updateChallenge(challengeId, {
                        current_week: 1,
                        weekly_visits: 0,
                    });
                } else {
                    // Graduate
                    await db.updateChallenge(challengeId, {
                        status: 'graduated',
                        graduated_at: getEffectiveNow().toISOString(),
                    });
                    return { completed: true, comboChange: 1, bonusChance, graduated: true };
                }
            } else {
                // Advance week
                await db.updateChallenge(challengeId, {
                    current_week: nextWeek,
                    weekly_visits: 0,
                });
            }

            return { completed: true, comboChange: 1, bonusChance };
        }

        // Goal not met — use chance or reset combo
        if (challenge.chances > 0) {
            await db.updateChallenge(challengeId, {
                chances: challenge.chances - 1,
            });

            const nextWeek = challenge.current_week + 1;
            if (nextWeek > challenge.duration_weeks) {
                if (challenge.repeat_mode) {
                    await db.updateChallenge(challengeId, { current_week: 1, weekly_visits: 0 });
                } else {
                    await db.updateChallenge(challengeId, {
                        status: 'graduated',
                        graduated_at: getEffectiveNow().toISOString(),
                    });
                    return { completed: false, chanceUsed: true, graduated: true };
                }
            } else {
                await db.updateChallenge(challengeId, { current_week: nextWeek, weekly_visits: 0 });
            }

            return { completed: false, chanceUsed: true };
        }

        // No chances — combo reset
        await db.updateChallenge(challengeId, { combo: 0 });

        const nextWeek = challenge.current_week + 1;
        if (nextWeek > challenge.duration_weeks) {
            if (challenge.repeat_mode) {
                await db.updateChallenge(challengeId, { current_week: 1, weekly_visits: 0 });
            } else {
                await db.updateChallenge(challengeId, {
                    status: 'graduated',
                    graduated_at: getEffectiveNow().toISOString(),
                });
                return { completed: false, graduated: true };
            }
        } else {
            await db.updateChallenge(challengeId, { current_week: nextWeek, weekly_visits: 0 });
        }

        return { completed: false, comboChange: -challenge.combo };
    },

    advanceWeek: async (challengeId) => {
        await get().checkWeeklyCompletion(challengeId);
        await get().loadChallenges();
    },

    startDwellSession: async (challengeId) => {
        const now = getEffectiveNow();
        const todayDow = getDayOfWeek(now);

        const challenge = await db.getChallengeById(challengeId);
        if (!challenge || challenge.status !== 'active') return;

        const visitId = await db.createVisitRecord({
            challenge_id: challengeId,
            entered_at: now.toISOString(),
            counted: false,
            day_of_week: todayDow,
            week: challenge.current_week,
        });

        const sessions = new Map(get().dwellSessions);
        sessions.set(challengeId, {
            challengeId,
            visitRecordId: visitId,
            enteredAt: now,
        });
        set({ dwellSessions: sessions });
    },

    endDwellSession: async (challengeId, dwellMinutes) => {
        const session = get().dwellSessions.get(challengeId);
        if (!session) return;

        await db.updateVisitRecord(session.visitRecordId, {
            exited_at: getEffectiveNow().toISOString(),
            dwell_minutes: dwellMinutes,
        });

        const sessions = new Map(get().dwellSessions);
        sessions.delete(challengeId);
        set({ dwellSessions: sessions });

        const challenge = await db.getChallengeById(challengeId);
        if (!challenge || challenge.status !== 'active') return;

        // Check if dwell time requirement is met
        if (challenge.dwell_time_enabled && challenge.dwell_time_minutes) {
            if (dwellMinutes >= challenge.dwell_time_minutes) {
                // Day-specific check
                const now = getEffectiveNow();
                const todayDow = getDayOfWeek(now);
                if (challenge.day_specific && challenge.days && !challenge.days.includes(todayDow)) {
                    return;
                }

                // Duplicate check
                const todayCount = await db.getCountedVisitsToday(challengeId, now.toISOString());
                if (todayCount > 0) return;

                // Count the visit
                await db.updateVisitRecord(session.visitRecordId, { counted: true });
                const newWeeklyVisits = challenge.weekly_visits + 1;
                await db.updateChallenge(challengeId, { weekly_visits: newWeeklyVisits });

                if (newWeeklyVisits >= challenge.weekly_goal) {
                    await get().checkWeeklyCompletion(challengeId);
                }
                await get().loadChallenges();
            }
        }
    },

    forceUpdateState: async (challengeId, updates) => {
        if (!__DEV__) return;
        await db.updateChallenge(challengeId, updates);
        await get().loadChallenges();
    },

    clearError: () => set({ error: null }),
}));

/**
 * Get DayOfWeek string from a Date
 */
export function getDayOfWeek(date: Date): DayOfWeek {
    return DAY_INDEX_TO_DOW[date.getDay()];
}

/**
 * Map DayOfWeek string to numeric index (0=Sun, 1=Mon, ..., 6=Sat)
 * Compatible with DayChips component
 */
export function dayOfWeekToIndex(dow: DayOfWeek): number {
    return DAY_INDEX_TO_DOW.indexOf(dow);
}

/**
 * Map numeric index (0=Sun, ..., 6=Sat) to DayOfWeek string
 */
export function indexToDayOfWeek(index: number): DayOfWeek {
    return DAY_INDEX_TO_DOW[index];
}

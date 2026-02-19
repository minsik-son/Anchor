/**
 * LocaAlert Database Service
 * SQLite database initialization and CRUD operations
 */

import * as SQLite from 'expo-sqlite';
import {
    CREATE_ALARMS_TABLE,
    CREATE_ACTION_MEMOS_TABLE,
    CREATE_CUSTOM_ACTIONS_TABLE,
    CREATE_CHALLENGES_TABLE,
    CREATE_VISIT_RECORDS_TABLE,
    Alarm,
    ActionMemo,
    CustomAction,
    ChallengeRow,
    VisitRecordRow,
    CreateAlarmInput,
    CreateActionMemoInput,
    CreateCustomActionInput,
    CreateChallengeInput,
    UpdateChallengeInput,
    DayOfWeek,
} from './schema';
import { runVersionedMigrations } from './migrations';
import { captureError } from '../utils/errorReporting';

const DB_NAME = 'locaalert.db';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize database and create tables
 */
export async function initDatabase(): Promise<void> {
    try {
        db = await SQLite.openDatabaseAsync(DB_NAME);

        await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      ${CREATE_ALARMS_TABLE}
      ${CREATE_ACTION_MEMOS_TABLE}
      ${CREATE_CUSTOM_ACTIONS_TABLE}
      ${CREATE_CHALLENGES_TABLE}
      ${CREATE_VISIT_RECORDS_TABLE}
    `);

        await runVersionedMigrations(db);

        console.log('[DB] Database initialized successfully');
    } catch (error) {
        captureError(error, { module: 'Database', action: 'initDatabase' });
        throw error;
    }
}

/**
 * Get database instance
 */
export function getDatabase(): SQLite.SQLiteDatabase {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

// ========== ALARM OPERATIONS ==========

export async function createAlarm(input: CreateAlarmInput): Promise<number> {
    if (!input.title?.trim()) throw new Error('Title is required');
    if (isNaN(input.latitude) || isNaN(input.longitude)) throw new Error('Invalid coordinates');
    if (input.radius !== undefined && (isNaN(input.radius) || input.radius <= 0)) throw new Error('Invalid radius');

    const database = getDatabase();
    const result = await database.runAsync(
        `INSERT INTO alarms (title, latitude, longitude, radius, sound_uri, started_at, start_latitude, start_longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            input.title,
            input.latitude,
            input.longitude,
            input.radius ?? 500,
            input.sound_uri ?? null,
            new Date().toISOString(),
            input.start_latitude ?? null,
            input.start_longitude ?? null,
        ]
    );
    return result.lastInsertRowId;
}

export async function getAllAlarms(): Promise<Alarm[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<Alarm>('SELECT * FROM alarms ORDER BY created_at DESC');
    return rows.map(row => ({
        ...row,
        is_active: Boolean(row.is_active),
    }));
}

export async function getActiveAlarms(): Promise<Alarm[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<Alarm>('SELECT * FROM alarms WHERE is_active = 1');
    return rows.map(row => ({
        ...row,
        is_active: Boolean(row.is_active),
    }));
}

export async function getAlarmById(id: number): Promise<Alarm | null> {
    const database = getDatabase();
    const row = await database.getFirstAsync<Alarm>('SELECT * FROM alarms WHERE id = ?', [id]);
    if (!row) return null;
    return { ...row, is_active: Boolean(row.is_active) };
}

export async function updateAlarm(
    id: number,
    updates: Partial<CreateAlarmInput & {
        is_active: boolean;
        started_at: string | null;
        arrived_at: string | null;
        route_points: string | null;
        traveled_distance: number | null;
        cancelled_at: string | null;
    }>
): Promise<void> {
    const database = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.latitude !== undefined) { fields.push('latitude = ?'); values.push(updates.latitude); }
    if (updates.longitude !== undefined) { fields.push('longitude = ?'); values.push(updates.longitude); }
    if (updates.radius !== undefined) { fields.push('radius = ?'); values.push(updates.radius); }
    if (updates.sound_uri !== undefined) { fields.push('sound_uri = ?'); values.push(updates.sound_uri); }
    if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active ? 1 : 0); }
    if (updates.started_at !== undefined) { fields.push('started_at = ?'); values.push(updates.started_at); }
    if (updates.arrived_at !== undefined) { fields.push('arrived_at = ?'); values.push(updates.arrived_at); }
    if (updates.route_points !== undefined) { fields.push('route_points = ?'); values.push(updates.route_points); }
    if (updates.traveled_distance !== undefined) { fields.push('traveled_distance = ?'); values.push(updates.traveled_distance); }
    if (updates.cancelled_at !== undefined) { fields.push('cancelled_at = ?'); values.push(updates.cancelled_at); }

    if (fields.length === 0) return;
    values.push(id);

    await database.runAsync(`UPDATE alarms SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteAlarm(id: number): Promise<void> {
    const database = getDatabase();
    await database.runAsync('DELETE FROM alarms WHERE id = ?', [id]);
}

export async function deleteAllAlarms(): Promise<void> {
    const database = getDatabase();
    await database.runAsync('DELETE FROM alarms');
}

/**
 * Get recent unique destinations from completed alarms.
 * Used for "recent destinations" dropdown in search bar.
 */
export interface RecentDestination {
    title: string;
    latitude: number;
    longitude: number;
}

export async function getRecentDestinations(limit: number = 4): Promise<RecentDestination[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<RecentDestination>(
        `SELECT title, latitude, longitude
         FROM alarms
         WHERE arrived_at IS NOT NULL
         GROUP BY ROUND(latitude, 3), ROUND(longitude, 3)
         ORDER BY MAX(arrived_at) DESC
         LIMIT ?`,
        [limit],
    );
    return rows;
}

// ========== ACTION MEMO OPERATIONS ==========

export async function createActionMemo(input: CreateActionMemoInput): Promise<number> {
    const database = getDatabase();
    const result = await database.runAsync(
        `INSERT INTO action_memos (alarm_id, type, content) VALUES (?, ?, ?)`,
        [input.alarm_id, input.type, input.content]
    );
    return result.lastInsertRowId;
}

export async function getActionMemosByAlarmId(alarmId: number): Promise<ActionMemo[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<ActionMemo>(
        'SELECT * FROM action_memos WHERE alarm_id = ?',
        [alarmId]
    );
    return rows.map(row => ({
        ...row,
        is_checked: Boolean(row.is_checked),
    }));
}

export async function updateActionMemoChecked(id: number, isChecked: boolean): Promise<void> {
    const database = getDatabase();
    await database.runAsync('UPDATE action_memos SET is_checked = ? WHERE id = ?', [isChecked ? 1 : 0, id]);
}

export async function deleteActionMemo(id: number): Promise<void> {
    const database = getDatabase();
    await database.runAsync('DELETE FROM action_memos WHERE id = ?', [id]);
}

// ========== CUSTOM ACTION OPERATIONS ==========

export async function createCustomAction(input: CreateCustomActionInput): Promise<number> {
    const database = getDatabase();
    const result = await database.runAsync(
        `INSERT INTO custom_actions (name, app_scheme, icon_name, order_index) VALUES (?, ?, ?, ?)`,
        [input.name, input.app_scheme, input.icon_name ?? null, input.order_index ?? 0]
    );
    return result.lastInsertRowId;
}

export async function getAllCustomActions(): Promise<CustomAction[]> {
    const database = getDatabase();
    return database.getAllAsync<CustomAction>('SELECT * FROM custom_actions ORDER BY order_index ASC');
}

export async function deleteCustomAction(id: number): Promise<void> {
    const database = getDatabase();
    await database.runAsync('DELETE FROM custom_actions WHERE id = ?', [id]);
}

// ========== CHALLENGE OPERATIONS ==========

/** Raw DB row before parsing JSON/boolean fields */
interface RawChallengeRow {
    id: string;
    name: string | null;
    icon: string;
    latitude: number;
    longitude: number;
    radius: number;
    place_name: string;
    weekly_goal: number;
    day_specific: number;
    days: string | null;
    duration_weeks: number;
    repeat_mode: number;
    dwell_time_enabled: number;
    dwell_time_minutes: number | null;
    current_week: number;
    weekly_visits: number;
    combo: number;
    chances: number;
    status: string;
    created_at: string;
    graduated_at: string | null;
}

function parseChallengeRow(raw: RawChallengeRow): ChallengeRow {
    return {
        ...raw,
        icon: raw.icon as ChallengeRow['icon'],
        day_specific: Boolean(raw.day_specific),
        days: raw.days ? JSON.parse(raw.days) : null,
        repeat_mode: Boolean(raw.repeat_mode),
        dwell_time_enabled: Boolean(raw.dwell_time_enabled),
        status: raw.status as ChallengeRow['status'],
    };
}

export async function createChallenge(input: CreateChallengeInput): Promise<string> {
    const database = getDatabase();
    const id = `challenge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await database.runAsync(
        `INSERT INTO challenges (id, name, icon, latitude, longitude, radius, place_name, weekly_goal, day_specific, days, duration_weeks, repeat_mode, dwell_time_enabled, dwell_time_minutes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            input.name ?? null,
            input.icon,
            input.latitude,
            input.longitude,
            input.radius,
            input.place_name,
            input.weekly_goal,
            input.day_specific ? 1 : 0,
            input.days ? JSON.stringify(input.days) : null,
            input.duration_weeks,
            input.repeat_mode ? 1 : 0,
            input.dwell_time_enabled ? 1 : 0,
            input.dwell_time_minutes ?? null,
            new Date().toISOString(),
        ]
    );
    return id;
}

export async function getAllChallenges(): Promise<ChallengeRow[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<RawChallengeRow>('SELECT * FROM challenges ORDER BY created_at DESC');
    return rows.map(parseChallengeRow);
}

export async function getActiveChallenges(): Promise<ChallengeRow[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<RawChallengeRow>(
        `SELECT * FROM challenges WHERE status = 'active' ORDER BY created_at DESC`
    );
    return rows.map(parseChallengeRow);
}

export async function getChallengeById(id: string): Promise<ChallengeRow | null> {
    const database = getDatabase();
    const row = await database.getFirstAsync<RawChallengeRow>('SELECT * FROM challenges WHERE id = ?', [id]);
    if (!row) return null;
    return parseChallengeRow(row);
}

export async function updateChallenge(id: string, updates: UpdateChallengeInput): Promise<void> {
    const database = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.current_week !== undefined) { fields.push('current_week = ?'); values.push(updates.current_week); }
    if (updates.weekly_visits !== undefined) { fields.push('weekly_visits = ?'); values.push(updates.weekly_visits); }
    if (updates.combo !== undefined) { fields.push('combo = ?'); values.push(updates.combo); }
    if (updates.chances !== undefined) { fields.push('chances = ?'); values.push(updates.chances); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.graduated_at !== undefined) { fields.push('graduated_at = ?'); values.push(updates.graduated_at); }

    if (fields.length === 0) return;
    values.push(id);

    await database.runAsync(`UPDATE challenges SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteChallenge(id: string): Promise<void> {
    const database = getDatabase();
    await database.runAsync('DELETE FROM visit_records WHERE challenge_id = ?', [id]);
    await database.runAsync('DELETE FROM challenges WHERE id = ?', [id]);
}

// ========== VISIT RECORD OPERATIONS ==========

interface RawVisitRecordRow {
    id: string;
    challenge_id: string;
    entered_at: string;
    exited_at: string | null;
    dwell_minutes: number | null;
    counted: number;
    day_of_week: string;
    week: number;
}

function parseVisitRecordRow(raw: RawVisitRecordRow): VisitRecordRow {
    return {
        ...raw,
        counted: Boolean(raw.counted),
        day_of_week: raw.day_of_week as DayOfWeek,
    };
}

export async function createVisitRecord(record: {
    challenge_id: string;
    entered_at: string;
    exited_at?: string | null;
    dwell_minutes?: number | null;
    counted: boolean;
    day_of_week: DayOfWeek;
    week: number;
}): Promise<string> {
    const database = getDatabase();
    const id = `visit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await database.runAsync(
        `INSERT INTO visit_records (id, challenge_id, entered_at, exited_at, dwell_minutes, counted, day_of_week, week) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            record.challenge_id,
            record.entered_at,
            record.exited_at ?? null,
            record.dwell_minutes ?? null,
            record.counted ? 1 : 0,
            record.day_of_week,
            record.week,
        ]
    );
    return id;
}

export async function getVisitRecordsByChallengeId(challengeId: string): Promise<VisitRecordRow[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<RawVisitRecordRow>(
        'SELECT * FROM visit_records WHERE challenge_id = ? ORDER BY entered_at DESC',
        [challengeId]
    );
    return rows.map(parseVisitRecordRow);
}

export async function updateVisitRecord(
    id: string,
    updates: { exited_at?: string; dwell_minutes?: number; counted?: boolean }
): Promise<void> {
    const database = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.exited_at !== undefined) { fields.push('exited_at = ?'); values.push(updates.exited_at); }
    if (updates.dwell_minutes !== undefined) { fields.push('dwell_minutes = ?'); values.push(updates.dwell_minutes); }
    if (updates.counted !== undefined) { fields.push('counted = ?'); values.push(updates.counted ? 1 : 0); }

    if (fields.length === 0) return;
    values.push(id);

    await database.runAsync(`UPDATE visit_records SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function getCountedVisitsToday(challengeId: string, todayIso: string): Promise<number> {
    const database = getDatabase();
    const datePrefix = todayIso.substring(0, 10);
    const result = await database.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM visit_records WHERE challenge_id = ? AND counted = 1 AND entered_at LIKE ?`,
        [challengeId, `${datePrefix}%`]
    );
    return result?.count ?? 0;
}

// ========== TRACKING SESSION OPERATIONS (Crash Recovery) ==========

export interface TrackingSession {
    id: number;
    alarm_id: number;
    route_points: string;
    traveled_distance: number;
    last_checkpoint_at: string;
    is_active: boolean;
}

export async function upsertTrackingSession(session: {
    alarm_id: number;
    route_points: string;
    traveled_distance: number;
    last_checkpoint_at: string;
    is_active: boolean;
}): Promise<void> {
    const database = getDatabase();
    // Try update first, then insert
    const existing = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM tracking_sessions WHERE alarm_id = ? AND is_active = 1',
        [session.alarm_id]
    );

    if (existing) {
        await database.runAsync(
            `UPDATE tracking_sessions SET route_points = ?, traveled_distance = ?, last_checkpoint_at = ? WHERE id = ?`,
            [session.route_points, session.traveled_distance, session.last_checkpoint_at, existing.id]
        );
    } else {
        await database.runAsync(
            `INSERT INTO tracking_sessions (alarm_id, route_points, traveled_distance, last_checkpoint_at, is_active) VALUES (?, ?, ?, ?, ?)`,
            [session.alarm_id, session.route_points, session.traveled_distance, session.last_checkpoint_at, session.is_active ? 1 : 0]
        );
    }
}

export async function getActiveTrackingSession(): Promise<TrackingSession | null> {
    const database = getDatabase();
    const row = await database.getFirstAsync<{
        id: number;
        alarm_id: number;
        route_points: string;
        traveled_distance: number;
        last_checkpoint_at: string;
        is_active: number;
    }>(
        'SELECT * FROM tracking_sessions WHERE is_active = 1 ORDER BY last_checkpoint_at DESC LIMIT 1'
    );
    if (!row) return null;
    return { ...row, is_active: Boolean(row.is_active) };
}

export async function deactivateTrackingSession(alarmId: number): Promise<void> {
    const database = getDatabase();
    await database.runAsync(
        'UPDATE tracking_sessions SET is_active = 0 WHERE alarm_id = ?',
        [alarmId]
    );
}

// ========== TELEMETRY OPERATIONS ==========

export interface TelemetryLog {
    id: number;
    session_id: string;
    event_type: string;
    event_data: string | null;
    created_at: string;
}

export async function insertTelemetryLog(log: {
    session_id: string;
    event_type: string;
    event_data: string | null;
}): Promise<void> {
    const database = getDatabase();
    await database.runAsync(
        'INSERT INTO telemetry_logs (session_id, event_type, event_data) VALUES (?, ?, ?)',
        [log.session_id, log.event_type, log.event_data]
    );
}

export async function getTelemetryLogs(sessionId?: string): Promise<TelemetryLog[]> {
    const database = getDatabase();
    if (sessionId) {
        return database.getAllAsync<TelemetryLog>(
            'SELECT * FROM telemetry_logs WHERE session_id = ? ORDER BY created_at DESC',
            [sessionId]
        );
    }
    return database.getAllAsync<TelemetryLog>('SELECT * FROM telemetry_logs ORDER BY created_at DESC LIMIT 500');
}

export async function cleanOldTelemetryLogs(retentionDays: number = 30): Promise<void> {
    const database = getDatabase();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    await database.runAsync(
        'DELETE FROM telemetry_logs WHERE created_at < ?',
        [cutoff.toISOString()]
    );
}

// ========== PAGINATED QUERIES ==========

export async function getAlarmsPaginated(offset: number = 0, limit: number = 20): Promise<Alarm[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<Alarm>(
        'SELECT * FROM alarms ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
    );
    return rows.map(row => ({ ...row, is_active: Boolean(row.is_active) }));
}

export async function getAlarmsCount(): Promise<number> {
    const database = getDatabase();
    const result = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM alarms');
    return result?.count ?? 0;
}

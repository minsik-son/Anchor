/**
 * LocaAlert Database Service
 * SQLite database initialization and CRUD operations
 */

import * as SQLite from 'expo-sqlite';
import {
    CREATE_ALARMS_TABLE,
    CREATE_ACTION_MEMOS_TABLE,
    CREATE_CUSTOM_ACTIONS_TABLE,
    Alarm,
    ActionMemo,
    CustomAction,
    CreateAlarmInput,
    CreateActionMemoInput,
    CreateCustomActionInput,
} from './schema';

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
    `);

        await runMigrations(db);

        console.log('[DB] Database initialized successfully');
    } catch (error) {
        console.error('[DB] Failed to initialize database:', error);
        throw error;
    }
}

/**
 * Run schema migrations for existing databases
 */
async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
    const newColumns = [
        'ALTER TABLE alarms ADD COLUMN started_at TEXT',
        'ALTER TABLE alarms ADD COLUMN arrived_at TEXT',
        'ALTER TABLE alarms ADD COLUMN start_latitude REAL',
        'ALTER TABLE alarms ADD COLUMN start_longitude REAL',
    ];
    for (const sql of newColumns) {
        try {
            await database.runAsync(sql);
        } catch (e: any) {
            if (!e.message?.includes('duplicate column')) {
                console.warn('[DB Migration]', e.message);
            }
        }
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
    updates: Partial<CreateAlarmInput & { is_active: boolean; started_at: string | null; arrived_at: string | null }>
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

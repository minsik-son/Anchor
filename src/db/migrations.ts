/**
 * LocaAlert Database Migration System
 * Version-based sequential migrations using PRAGMA user_version
 */

import * as SQLite from 'expo-sqlite';

interface Migration {
    version: number;
    description: string;
    up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

const migrations: Migration[] = [
    {
        version: 1,
        description: 'Add tracking columns to alarms',
        up: async (db) => {
            // These may already exist from the old migration system
            // Use try-catch for backward compatibility
            const columns = [
                'ALTER TABLE alarms ADD COLUMN started_at TEXT',
                'ALTER TABLE alarms ADD COLUMN arrived_at TEXT',
                'ALTER TABLE alarms ADD COLUMN start_latitude REAL',
                'ALTER TABLE alarms ADD COLUMN start_longitude REAL',
            ];
            for (const sql of columns) {
                try {
                    await db.runAsync(sql);
                } catch (e: any) {
                    if (!e.message?.includes('duplicate column')) throw e;
                }
            }
        },
    },
    {
        version: 2,
        description: 'Add route history and cancellation to alarms',
        up: async (db) => {
            const columns = [
                'ALTER TABLE alarms ADD COLUMN route_points TEXT',
                'ALTER TABLE alarms ADD COLUMN traveled_distance REAL',
                'ALTER TABLE alarms ADD COLUMN cancelled_at TEXT',
            ];
            for (const sql of columns) {
                try {
                    await db.runAsync(sql);
                } catch (e: any) {
                    if (!e.message?.includes('duplicate column')) throw e;
                }
            }
        },
    },
    {
        version: 3,
        description: 'Add database indexes for performance',
        up: async (db) => {
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_alarms_is_active ON alarms(is_active)');
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_alarms_created_at ON alarms(created_at DESC)');
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_alarms_arrived_at ON alarms(arrived_at)');
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_action_memos_alarm_id ON action_memos(alarm_id)');
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_visit_records_challenge ON visit_records(challenge_id)');
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status)');
        },
    },
    {
        version: 4,
        description: 'Add tracking sessions for crash recovery',
        up: async (db) => {
            await db.runAsync(`
                CREATE TABLE IF NOT EXISTS tracking_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    alarm_id INTEGER NOT NULL,
                    route_points TEXT NOT NULL,
                    traveled_distance REAL DEFAULT 0,
                    last_checkpoint_at TEXT NOT NULL,
                    is_active INTEGER DEFAULT 1,
                    FOREIGN KEY (alarm_id) REFERENCES alarms(id) ON DELETE CASCADE
                )
            `);
        },
    },
    {
        version: 5,
        description: 'Add telemetry logs table',
        up: async (db) => {
            await db.runAsync(`
                CREATE TABLE IF NOT EXISTS telemetry_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    event_data TEXT,
                    created_at TEXT DEFAULT (datetime('now', 'localtime'))
                )
            `);
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_logs(session_id)');
            await db.runAsync('CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_logs(event_type)');
        },
    },
];

/**
 * Run pending migrations based on current DB version.
 * Uses PRAGMA user_version to track schema version.
 */
export async function runVersionedMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
    const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const currentVersion = result?.user_version ?? 0;

    const pending = migrations.filter(m => m.version > currentVersion);

    if (pending.length === 0) {
        console.log(`[DB Migration] Schema up to date (v${currentVersion})`);
        return;
    }

    console.log(`[DB Migration] Current version: ${currentVersion}, running ${pending.length} migration(s)`);

    for (const migration of pending) {
        console.log(`[DB Migration] Running v${migration.version}: ${migration.description}`);
        try {
            await migration.up(db);
            await db.runAsync(`PRAGMA user_version = ${migration.version}`);
            console.log(`[DB Migration] Completed v${migration.version}`);
        } catch (error) {
            console.error(`[DB Migration] Failed at v${migration.version}:`, error);
            throw error;
        }
    }

    const finalVersion = pending[pending.length - 1].version;
    console.log(`[DB Migration] All migrations complete. DB version: ${finalVersion}`);
}

export { migrations };

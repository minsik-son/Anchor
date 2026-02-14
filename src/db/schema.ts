/**
 * LocaAlert Database Schema
 * SQLite tables for Alarms, ActionMemos, CustomActions, Challenges, and VisitRecords
 */

export const CREATE_ALARMS_TABLE = `
CREATE TABLE IF NOT EXISTS alarms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius INTEGER DEFAULT 500,
  is_active INTEGER DEFAULT 1,
  sound_uri TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  started_at TEXT,
  arrived_at TEXT,
  start_latitude REAL,
  start_longitude REAL
);
`;

export const CREATE_ACTION_MEMOS_TABLE = `
CREATE TABLE IF NOT EXISTS action_memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alarm_id INTEGER NOT NULL,
  type TEXT CHECK(type IN ('CHECKLIST', 'IMAGE')) NOT NULL,
  content TEXT NOT NULL,
  is_checked INTEGER DEFAULT 0,
  FOREIGN KEY (alarm_id) REFERENCES alarms(id) ON DELETE CASCADE
);
`;

export const CREATE_CUSTOM_ACTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS custom_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  app_scheme TEXT NOT NULL,
  icon_name TEXT,
  order_index INTEGER DEFAULT 0
);
`;

// Type definitions for database records
export interface Alarm {
    id: number;
    title: string;
    latitude: number;
    longitude: number;
    radius: number;
    is_active: boolean;
    sound_uri: string | null;
    created_at: string;
    started_at: string | null;
    arrived_at: string | null;
    start_latitude: number | null;
    start_longitude: number | null;
}

export interface ActionMemo {
    id: number;
    alarm_id: number;
    type: 'CHECKLIST' | 'IMAGE';
    content: string;
    is_checked: boolean;
}

export interface CustomAction {
    id: number;
    name: string;
    app_scheme: string;
    icon_name: string | null;
    order_index: number;
}

// Input types for creating new records
export interface CreateAlarmInput {
    title: string;
    latitude: number;
    longitude: number;
    radius?: number;
    sound_uri?: string;
    start_latitude?: number;
    start_longitude?: number;
}

export interface CreateActionMemoInput {
    alarm_id: number;
    type: 'CHECKLIST' | 'IMAGE';
    content: string;
}

export interface CreateCustomActionInput {
    name: string;
    app_scheme: string;
    icon_name?: string;
    order_index?: number;
}

// ========== CHALLENGE SCHEMA ==========

export type ChallengeIcon = 'fitness' | 'walk' | 'book' | 'cafe' | 'bicycle';
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type ChallengeStatus = 'active' | 'graduated' | 'failed';

export const CREATE_CHALLENGES_TABLE = `
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
`;

export const CREATE_VISIT_RECORDS_TABLE = `
CREATE TABLE IF NOT EXISTS visit_records (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  entered_at TEXT NOT NULL,
  exited_at TEXT,
  dwell_minutes REAL,
  counted INTEGER NOT NULL DEFAULT 0,
  day_of_week TEXT NOT NULL,
  week INTEGER NOT NULL,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
);
`;

export interface ChallengeRow {
    id: string;
    name: string | null;
    icon: ChallengeIcon;
    latitude: number;
    longitude: number;
    radius: number;
    place_name: string;
    weekly_goal: number;
    day_specific: boolean;
    days: DayOfWeek[] | null;
    duration_weeks: number;
    repeat_mode: boolean;
    dwell_time_enabled: boolean;
    dwell_time_minutes: number | null;
    current_week: number;
    weekly_visits: number;
    combo: number;
    chances: number;
    status: ChallengeStatus;
    created_at: string;
    graduated_at: string | null;
}

export interface VisitRecordRow {
    id: string;
    challenge_id: string;
    entered_at: string;
    exited_at: string | null;
    dwell_minutes: number | null;
    counted: boolean;
    day_of_week: DayOfWeek;
    week: number;
}

export interface CreateChallengeInput {
    name?: string;
    icon: ChallengeIcon;
    latitude: number;
    longitude: number;
    radius: number;
    place_name: string;
    weekly_goal: number;
    day_specific?: boolean;
    days?: DayOfWeek[];
    duration_weeks: number;
    repeat_mode?: boolean;
    dwell_time_enabled?: boolean;
    dwell_time_minutes?: number | null;
}

export interface UpdateChallengeInput {
    name?: string;
    current_week?: number;
    weekly_visits?: number;
    combo?: number;
    chances?: number;
    status?: ChallengeStatus;
    graduated_at?: string | null;
}

/**
 * LocaAlert Database Schema
 * SQLite tables for Alarms, ActionMemos, and CustomActions
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

// ========== ROUTINE SCHEMA ==========

export const CREATE_ROUTINES_TABLE = `
CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'business',
  location_name TEXT NOT NULL DEFAULT '',
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius INTEGER DEFAULT 500,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  repeat_days TEXT NOT NULL DEFAULT '[]',
  is_enabled INTEGER DEFAULT 1,
  sound TEXT DEFAULT 'breeze',
  memo TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
`;

export interface RoutineRow {
    id: number;
    name: string;
    icon: string;
    location_name: string;
    latitude: number;
    longitude: number;
    radius: number;
    start_time: string;
    end_time: string;
    repeat_days: number[];
    is_enabled: boolean;
    sound: string;
    memo: string;
    created_at: string;
}

export interface CreateRoutineInput {
    name: string;
    icon?: string;
    location_name: string;
    latitude: number;
    longitude: number;
    radius?: number;
    start_time: string;
    end_time: string;
    repeat_days: number[];
    sound?: string;
    memo?: string;
}

export interface UpdateRoutineInput {
    name?: string;
    icon?: string;
    location_name?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    start_time?: string;
    end_time?: string;
    repeat_days?: number[];
    is_enabled?: boolean;
    sound?: string;
    memo?: string;
}

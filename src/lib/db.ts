import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { getTodayKst, shiftDate } from '@/lib/domain';
import { buildSeedRooms } from '@/lib/seed-data';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

interface GlobalDbHolder {
  __ongiDbState?: {
    db: DatabaseSyncType;
    dbPath: string;
  };
}

const g = globalThis as unknown as GlobalDbHolder;

export function closeAndResetDbCache(): void {
  if (g.__ongiDbState) {
    try {
      g.__ongiDbState.db.close();
    } catch {
      // ignore already closed
    }
    g.__ongiDbState = undefined;
  }
}

function initSchema(db: DatabaseSyncType): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      tag TEXT NOT NULL,
      category TEXT NOT NULL,
      max_capacity INTEGER NOT NULL,
      streak_days INTEGER NOT NULL DEFAULT 0,
      last_completed_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_members (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      avatar_initial TEXT NOT NULL,
      is_current_user INTEGER NOT NULL DEFAULT 0,
      is_host INTEGER NOT NULL DEFAULT 0,
      member_streak_days INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      UNIQUE(room_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS daily_checkins (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES room_members(id) ON DELETE CASCADE,
      checkin_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('photo', 'rest')),
      image_data TEXT,
      note TEXT NOT NULL DEFAULT '',
      timestamp_label TEXT NOT NULL,
      likes_count INTEGER NOT NULL DEFAULT 0,
      liked_by_me INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(room_id, member_id, checkin_date)
    );
  `);
}

function seedDatabaseIfEmpty(db: DatabaseSyncType, today: string): void {
  const row = db.prepare('SELECT COUNT(*) AS count FROM rooms').get() as { count: number };
  if (row.count > 0) return;

  const insertRoom = db.prepare(`
    INSERT INTO rooms (id, title, tag, category, max_capacity, streak_days, last_completed_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMember = db.prepare(`
    INSERT INTO room_members (id, room_id, user_id, nickname, avatar_initial, is_current_user, is_host, member_streak_days, last_active_date, joined_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertCheckin = db.prepare(`
    INSERT INTO daily_checkins (id, room_id, member_id, checkin_date, status, image_data, note, timestamp_label, likes_count, liked_by_me, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seeds = buildSeedRooms(today);

  db.exec('BEGIN');
  try {
    for (const room of seeds) {
      insertRoom.run(
        room.id,
        room.title,
        room.tag,
        room.category,
        room.maxCapacity,
        room.streakDays,
        room.lastCompletedDate,
        `${shiftDate(today, -14)}T09:00:00Z`
      );

      for (const m of room.members) {
        insertMember.run(
          m.id,
          room.id,
          m.userId,
          m.nickname,
          m.avatarInitial,
          m.isCurrentUser ? 1 : 0,
          m.isHost ? 1 : 0,
          m.memberStreakDays,
          shiftDate(today, m.lastActiveOffset),
          shiftDate(today, m.joinedOffset)
        );
      }

      for (const c of room.checkins) {
        const d = shiftDate(today, c.dayOffset);
        insertCheckin.run(
          c.id,
          room.id,
          c.memberId,
          d,
          c.status,
          c.imageData,
          c.note,
          c.timestampLabel,
          c.likesCount,
          c.likedByMe ? 1 : 0,
          `${d}T12:00:00Z`
        );
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getDb(seedToday: string = getTodayKst()): DatabaseSyncType {
  const targetPath = process.env.ONGI_DB_PATH || path.join(process.cwd(), 'data', 'ongi.db');

  if (g.__ongiDbState && g.__ongiDbState.dbPath === targetPath) {
    return g.__ongiDbState.db;
  }

  if (g.__ongiDbState) {
    closeAndResetDbCache();
  }

  if (targetPath !== ':memory:') {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  }

  const db = new DatabaseSync(targetPath);
  if (targetPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  initSchema(db);
  seedDatabaseIfEmpty(db, seedToday);

  g.__ongiDbState = { db, dbPath: targetPath };
  return db;
}

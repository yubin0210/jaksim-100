import crypto from 'node:crypto';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { getDb } from '@/lib/db';
import {
  computeCompletionStats,
  computeNextMemberStreak,
  computeNextRoomStreak,
  evaluateInactiveEvictions,
  getMondayOfWeek,
  getTodayKst,
  resolveBoardLayout,
  shiftDate,
  sortExploreRooms,
} from '@/lib/domain';
import type {
  AlbumEntry,
  AlbumResponse,
  DailyCheckin,
  InspirationSnippet,
  PreviewTile,
  Room,
  RoomCapacity,
  RoomDetailResponse,
  RoomMember,
  RoomSummary,
  WeekRhythmDay,
} from '@/types/ongi';

interface RoomRow {
  id: string;
  title: string;
  tag: string;
  category: string;
  max_capacity: number;
  streak_days: number;
  last_completed_date: string | null;
  created_at: string;
}

interface MemberRow {
  id: string;
  room_id: string;
  user_id: string;
  nickname: string;
  avatar_initial: string;
  is_current_user: number;
  is_host: number;
  member_streak_days: number;
  last_active_date: string;
  joined_at: string;
}

interface CheckinRow {
  id: string;
  room_id: string;
  member_id: string;
  member_nickname: string;
  member_avatar_initial: string;
  is_current_user: number;
  checkin_date: string;
  status: 'photo' | 'rest';
  image_data: string | null;
  note: string;
  timestamp_label: string;
  likes_count: number;
  liked_by_me: number;
  created_at: string;
}

function mapRoom(row: RoomRow): Room {
  return {
    id: row.id,
    title: row.title,
    tag: row.tag,
    category: row.category,
    maxCapacity: row.max_capacity as RoomCapacity,
    streakDays: row.streak_days,
    lastCompletedDate: row.last_completed_date,
    createdAt: row.created_at,
  };
}

function mapMember(row: MemberRow): RoomMember {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    nickname: row.nickname,
    avatarInitial: row.avatar_initial,
    isCurrentUser: row.is_current_user === 1,
    isHost: row.is_host === 1,
    memberStreakDays: row.member_streak_days,
    lastActiveDate: row.last_active_date,
    joinedAt: row.joined_at,
  };
}

function mapCheckin(row: CheckinRow): DailyCheckin {
  return {
    id: row.id,
    roomId: row.room_id,
    memberId: row.member_id,
    memberNickname: row.member_nickname,
    memberAvatarInitial: row.member_avatar_initial,
    isCurrentUser: row.is_current_user === 1,
    checkinDate: row.checkin_date,
    status: row.status,
    imageData: row.image_data,
    note: row.note,
    timestampLabel: row.timestamp_label,
    likesCount: row.likes_count,
    likedByMe: row.liked_by_me === 1,
    createdAt: row.created_at,
  };
}

function getRoomMembers(db: DatabaseSyncType, roomId: string): RoomMember[] {
  const rows = db
    .prepare(
      `SELECT id, room_id, user_id, nickname, avatar_initial, is_current_user, is_host, member_streak_days, last_active_date, joined_at
       FROM room_members WHERE room_id = ? ORDER BY is_current_user ASC, joined_at ASC`
    )
    .all(roomId) as unknown as MemberRow[];
  return rows.map(mapMember);
}

function syncRoomEvictions(db: DatabaseSyncType, roomId: string, today: string): RoomMember[] {
  const members = getRoomMembers(db, roomId);
  if (members.length <= 1) return members;

  const { evictedIds, newHostMemberId, kept } = evaluateInactiveEvictions({
    members,
    today,
    protectCurrentUser: true,
  });

  if (evictedIds.length === 0) return members;

  const delStmt = db.prepare('DELETE FROM room_members WHERE id = ?');
  for (const id of evictedIds) {
    delStmt.run(id);
  }
  if (newHostMemberId) {
    db.prepare('UPDATE room_members SET is_host = 1 WHERE id = ?').run(newHostMemberId);
  }
  return kept;
}

function getCheckinsForRoomDate(
  db: DatabaseSyncType,
  roomId: string,
  dateStr: string
): DailyCheckin[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.room_id, c.member_id, m.nickname AS member_nickname, m.avatar_initial AS member_avatar_initial,
              m.is_current_user, c.checkin_date, c.status, c.image_data, c.note, c.timestamp_label,
              c.likes_count, c.liked_by_me, c.created_at
       FROM daily_checkins c
       JOIN room_members m ON m.id = c.member_id
       WHERE c.room_id = ? AND c.checkin_date = ?
       ORDER BY m.is_current_user ASC, c.created_at ASC`
    )
    .all(roomId, dateStr) as unknown as CheckinRow[];
  return rows.map(mapCheckin);
}

function countRestPassesUsedThisWeek(
  db: DatabaseSyncType,
  roomId: string,
  memberId: string,
  today: string
): number {
  const monday = getMondayOfWeek(today);
  const sunday = shiftDate(monday, 6);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM daily_checkins
       WHERE room_id = ? AND member_id = ? AND status = 'rest'
         AND checkin_date >= ? AND checkin_date <= ?`
    )
    .get(roomId, memberId, monday, sunday) as { count: number };
  return row.count;
}

function inferCategory(title: string, tag: string, explicit?: string): string {
  if (explicit && ['exercise', 'reading', 'drawing', 'study'].includes(explicit)) {
    return explicit;
  }
  const text = `${title} ${tag}`.toLowerCase();
  if (/운동|헬스|러닝|산책|요가|오운완|수영|등산/.test(text)) return 'exercise';
  if (/독서|책|글쓰기|필사|원서|에세이/.test(text)) return 'reading';
  if (/드로잉|그림|크로키|스케치|악기|피아노|기타/.test(text)) return 'drawing';
  return 'study';
}

function normalizeTag(tag: string): string {
  const clean = tag.trim().replace(/\s+/g, '');
  if (!clean) return '#자기계발';
  return clean.startsWith('#') ? clean : `#${clean}`;
}

function formatCurrentTimeLabel(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const h = kst.getUTCHours();
  const m = String(kst.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = String(h % 12 || 12).padStart(2, '0');
  return `${h12}:${m} ${ampm}`;
}

function getSameTagInspiration(
  db: DatabaseSyncType,
  room: Room,
  today: string
): InspirationSnippet[] {
  const rows = db
    .prepare(
      `SELECT c.id, r.title AS room_title, r.tag, m.nickname, c.image_data, c.note, c.timestamp_label
       FROM daily_checkins c
       JOIN rooms r ON r.id = c.room_id
       JOIN room_members m ON m.id = c.member_id
       WHERE c.room_id != ? AND c.status = 'photo' AND c.image_data IS NOT NULL
       ORDER BY
         CASE WHEN r.tag = ? THEN 0 WHEN r.category = ? THEN 1 ELSE 2 END,
         CASE WHEN c.checkin_date = ? THEN 0 ELSE 1 END,
         c.created_at DESC
       LIMIT 4`
    )
    .all(room.id, room.tag, room.category, today) as {
      id: string;
      room_title: string;
      tag: string;
      nickname: string;
      image_data: string;
      note: string;
      timestamp_label: string;
    }[];

  return rows.map(r => ({
    id: r.id,
    roomTitle: r.room_title,
    tag: r.tag,
    nickname: r.nickname,
    imageData: r.image_data,
    note: r.note,
    timestampLabel: r.timestamp_label,
  }));
}

function buildRoomSummary(
  db: DatabaseSyncType,
  roomRow: RoomRow,
  today: string
): RoomSummary {
  const room = mapRoom(roomRow);
  const members = syncRoomEvictions(db, room.id, today);
  const checkins = getCheckinsForRoomDate(db, room.id, today);
  const me = members.find(m => m.isCurrentUser);
  const myCheckin = me ? checkins.find(c => c.memberId === me.id) : undefined;

  const stats = computeCompletionStats(members.length, checkins.length);
  const streakInfo = computeNextRoomStreak({
    currentStreak: room.streakDays,
    lastCompletedDate: room.lastCompletedDate,
    today,
    isRoomCompleteToday: stats.isComplete,
  });

  const checkinByMember = new Map(checkins.map(c => [c.memberId, c]));
  const previewTiles: PreviewTile[] = members.map(m => {
    const ch = checkinByMember.get(m.id);
    if (!ch) return { status: 'empty', imageData: null, nickname: m.nickname };
    return {
      status: ch.status,
      imageData: ch.imageData,
      nickname: m.nickname,
    };
  });

  const restUsed = me ? countRestPassesUsedThisWeek(db, room.id, me.id, today) : 0;

  return {
    id: room.id,
    title: room.title,
    tag: room.tag,
    category: room.category,
    maxCapacity: room.maxCapacity,
    memberCount: members.length,
    streakDays: streakInfo.streakDays,
    completedCount: stats.completedCount,
    completionPercent: stats.percent,
    myStatusToday: myCheckin ? myCheckin.status : 'pending',
    isJoined: Boolean(me),
    restPassesLeftThisWeek: Math.max(0, 1 - restUsed),
    previewTiles,
  };
}

export function listRoomsOverview(params?: {
  today?: string;
  query?: string;
  filter?: string;
}): {
  myRooms: RoomSummary[];
  exploreRooms: RoomSummary[];
  weekRhythm: WeekRhythmDay[];
} {
  const today = params?.today || getTodayKst();
  const db = getDb(today);

  const allRows = db
    .prepare('SELECT * FROM rooms ORDER BY created_at DESC')
    .all() as unknown as RoomRow[];

  const summaries = allRows.map(r => buildRoomSummary(db, r, today));
  const myRooms = summaries.filter(s => s.isJoined);

  const query = (params?.query || '').trim().toLowerCase();
  const filter = (params?.filter || 'all').trim();

  const openExplore = summaries.filter(s => {
    if (s.isJoined) return false;
    if (s.memberCount >= s.maxCapacity) return false;
    if (filter === 'almost' && s.maxCapacity - s.memberCount !== 1) return false;
    if (
      filter !== 'all' &&
      filter !== 'almost' &&
      s.category !== filter &&
      !s.tag.toLowerCase().includes(filter.toLowerCase())
    ) {
      return false;
    }
    if (
      query &&
      !(
        s.title.toLowerCase().includes(query) ||
        s.tag.toLowerCase().includes(query)
      )
    ) {
      return false;
    }
    return true;
  });

  const exploreRooms = sortExploreRooms(openExplore);

  // Build Monday..Sunday week rhythm for user_me
  const monday = getMondayOfWeek(today);
  const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];
  const weekRows = db
    .prepare(
      `SELECT DISTINCT c.checkin_date
       FROM daily_checkins c
       JOIN room_members m ON m.id = c.member_id
       WHERE m.is_current_user = 1 AND c.checkin_date >= ? AND c.checkin_date <= ?`
    )
    .all(monday, shiftDate(monday, 6)) as { checkin_date: string }[];
  const activeDates = new Set(weekRows.map(r => r.checkin_date));

  const weekRhythm: WeekRhythmDay[] = dayLabels.map((label, idx) => {
    const date = shiftDate(monday, idx);
    return {
      label,
      date,
      done: activeDates.has(date),
      isToday: date === today,
    };
  });

  return { myRooms, exploreRooms, weekRhythm };
}

export function createRoom(
  input: { title: string; tag: string; category?: string; maxCapacity: RoomCapacity },
  today: string = getTodayKst()
): RoomDetailResponse {
  const db = getDb(today);
  const title = input.title.trim();
  const tag = normalizeTag(input.tag);
  const category = inferCategory(title, tag, input.category);
  const maxCapacity: RoomCapacity =
    input.maxCapacity === 2 || input.maxCapacity === 6 ? input.maxCapacity : 4;

  const roomId = `room-${crypto.randomUUID().slice(0, 8)}`;
  const memberId = `mem-${crypto.randomUUID().slice(0, 8)}`;
  const nowIso = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO rooms (id, title, tag, category, max_capacity, streak_days, last_completed_date, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`
    ).run(roomId, title, tag, category, maxCapacity, nowIso);

    db.prepare(
      `INSERT INTO room_members (id, room_id, user_id, nickname, avatar_initial, is_current_user, is_host, member_streak_days, last_active_date, joined_at)
       VALUES (?, ?, 'user_me', '나', '나', 1, 1, 0, ?, ?)`
    ).run(memberId, roomId, today, today);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return getRoomDetail(roomId, today, today)!;
}

export function getRoomDetail(
  roomId: string,
  selectedDate?: string,
  today: string = getTodayKst()
): RoomDetailResponse | null {
  const db = getDb(today);
  const row = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as
    | RoomRow
    | undefined;
  if (!row) return null;

  const members = syncRoomEvictions(db, roomId, today);
  const targetDate = selectedDate || today;
  const checkins = getCheckinsForRoomDate(db, roomId, targetDate);

  const dateRows = db
    .prepare(
      `SELECT DISTINCT checkin_date FROM daily_checkins WHERE room_id = ? ORDER BY checkin_date DESC`
    )
    .all(roomId) as { checkin_date: string }[];
  const dateSet = new Set([today, ...dateRows.map(d => d.checkin_date)]);
  const availableDates = [...dateSet].sort((a, b) => b.localeCompare(a));

  const completion = computeCompletionStats(members.length, checkins.length);
  const room = mapRoom(row);

  // Reflect live streak reset if yesterday was missed before today completes
  const todayCheckins = targetDate === today ? checkins : getCheckinsForRoomDate(db, roomId, today);
  const todayComplete = computeCompletionStats(members.length, todayCheckins.length).isComplete;
  const effectiveStreak = computeNextRoomStreak({
    currentStreak: room.streakDays,
    lastCompletedDate: room.lastCompletedDate,
    today,
    isRoomCompleteToday: todayComplete,
  });
  room.streakDays = effectiveStreak.streakDays;

  const me = members.find(m => m.isCurrentUser);
  const myCheckinOnDate = me ? checkins.find(c => c.memberId === me.id) : undefined;
  const restUsed = me ? countRestPassesUsedThisWeek(db, roomId, me.id, today) : 0;

  const sameTagInspiration =
    members.length <= 1 ? getSameTagInspiration(db, room, today) : [];

  return {
    room,
    members,
    checkins,
    selectedDate: targetDate,
    today,
    availableDates,
    layoutMode: resolveBoardLayout(members.length),
    completion,
    restPassesLeftThisWeek: Math.max(0, 1 - restUsed),
    myStatusOnSelectedDate: myCheckinOnDate ? myCheckinOnDate.status : 'pending',
    sameTagInspiration,
  };
}

export function joinRoom(
  roomId: string,
  today: string = getTodayKst()
):
  | { ok: true; room: RoomDetailResponse }
  | { ok: false; status: 404 | 409; error: string } {
  const db = getDb(today);
  const row = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as
    | RoomRow
    | undefined;
  if (!row) {
    return { ok: false, status: 404, error: '방을 찾을 수 없어요.' };
  }

  const members = syncRoomEvictions(db, roomId, today);
  if (members.some(m => m.isCurrentUser)) {
    return { ok: false, status: 409, error: '이미 참여 중인 방이에요.' };
  }
  if (members.length >= row.max_capacity) {
    return { ok: false, status: 409, error: '방 정원이 모두 찼어요.' };
  }

  const memberId = `mem-${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(
    `INSERT INTO room_members (id, room_id, user_id, nickname, avatar_initial, is_current_user, is_host, member_streak_days, last_active_date, joined_at)
     VALUES (?, ?, 'user_me', '나', '나', 1, 0, 0, ?, ?)`
  ).run(memberId, roomId, today, today);

  return { ok: true, room: getRoomDetail(roomId, today, today)! };
}

function finalizeRoomCompletionAfterCheckin(
  db: DatabaseSyncType,
  room: RoomRow,
  member: RoomMember,
  today: string
): void {
  const nextMemberStreak = computeNextMemberStreak({
    currentStreak: member.memberStreakDays,
    lastActiveDate: member.lastActiveDate,
    today,
  });

  db.prepare(
    `UPDATE room_members SET member_streak_days = ?, last_active_date = ? WHERE id = ?`
  ).run(nextMemberStreak, today, member.id);

  const members = getRoomMembers(db, room.id);
  const todayCheckins = getCheckinsForRoomDate(db, room.id, today);
  const stats = computeCompletionStats(members.length, todayCheckins.length);

  if (stats.isComplete) {
    const nextRoomStreak = computeNextRoomStreak({
      currentStreak: room.streak_days,
      lastCompletedDate: room.last_completed_date,
      today,
      isRoomCompleteToday: true,
    });
    db.prepare(
      `UPDATE rooms SET streak_days = ?, last_completed_date = ? WHERE id = ?`
    ).run(nextRoomStreak.streakDays, nextRoomStreak.lastCompletedDate, room.id);
  }
}

export function submitPhotoCheckin(
  roomId: string,
  input: { imageData: string; note?: string; timestampLabel?: string },
  today: string = getTodayKst()
):
  | { ok: true; checkin: DailyCheckin; room: RoomDetailResponse }
  | { ok: false; status: 400 | 404 | 409; error: string } {
  const db = getDb(today);
  const roomRow = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as
    | RoomRow
    | undefined;
  if (!roomRow) {
    return { ok: false, status: 404, error: '방을 찾을 수 없어요.' };
  }

  const imageData = (input.imageData || '').trim();
  if (!imageData) {
    return { ok: false, status: 400, error: '실시간 촬영 사진이 필요해요.' };
  }

  const members = syncRoomEvictions(db, roomId, today);
  const me = members.find(m => m.isCurrentUser);
  if (!me) {
    return { ok: false, status: 400, error: '먼저 방에 참여한 뒤 인증해 주세요.' };
  }

  const existing = db
    .prepare(
      `SELECT id FROM daily_checkins WHERE room_id = ? AND member_id = ? AND checkin_date = ?`
    )
    .get(roomId, me.id, today) as { id: string } | undefined;
  if (existing) {
    return { ok: false, status: 409, error: '오늘은 이미 이 방에 인증을 남겼어요.' };
  }

  const checkinId = `chk-${crypto.randomUUID().slice(0, 8)}`;
  const note = (input.note || '').trim().slice(0, 80) || '오늘도 작은 한 걸음 완료!';
  const timestampLabel = (input.timestampLabel || '').trim() || formatCurrentTimeLabel();
  const createdAt = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO daily_checkins (id, room_id, member_id, checkin_date, status, image_data, note, timestamp_label, likes_count, liked_by_me, created_at)
       VALUES (?, ?, ?, ?, 'photo', ?, ?, ?, 0, 0, ?)`
    ).run(checkinId, roomId, me.id, today, imageData, note, timestampLabel, createdAt);

    finalizeRoomCompletionAfterCheckin(db, roomRow, me, today);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const roomDetail = getRoomDetail(roomId, today, today)!;
  const checkin = roomDetail.checkins.find(c => c.id === checkinId)!;
  return { ok: true, checkin, room: roomDetail };
}

export function submitRestPass(
  roomId: string,
  today: string = getTodayKst()
):
  | { ok: true; checkin: DailyCheckin; room: RoomDetailResponse }
  | { ok: false; status: 400 | 404 | 409; error: string } {
  const db = getDb(today);
  const roomRow = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as
    | RoomRow
    | undefined;
  if (!roomRow) {
    return { ok: false, status: 404, error: '방을 찾을 수 없어요.' };
  }

  const members = syncRoomEvictions(db, roomId, today);
  const me = members.find(m => m.isCurrentUser);
  if (!me) {
    return { ok: false, status: 400, error: '먼저 방에 참여한 뒤 휴식권을 사용해 주세요.' };
  }

  const existingToday = db
    .prepare(
      `SELECT id FROM daily_checkins WHERE room_id = ? AND member_id = ? AND checkin_date = ?`
    )
    .get(roomId, me.id, today) as { id: string } | undefined;
  if (existingToday) {
    return { ok: false, status: 409, error: '오늘은 이미 이 방에 기록을 남겼어요.' };
  }

  const restUsed = countRestPassesUsedThisWeek(db, roomId, me.id, today);
  if (restUsed >= 1) {
    return { ok: false, status: 400, error: '이번 주 휴식권(주 1회)을 이미 모두 사용했어요.' };
  }

  const checkinId = `chk-${crypto.randomUUID().slice(0, 8)}`;
  const timestampLabel = formatCurrentTimeLabel();
  const createdAt = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO daily_checkins (id, room_id, member_id, checkin_date, status, image_data, note, timestamp_label, likes_count, liked_by_me, created_at)
       VALUES (?, ?, ?, ?, 'rest', NULL, '오늘은 잠시 쉬어가도 괜찮아요', ?, 0, 0, ?)`
    ).run(checkinId, roomId, me.id, today, timestampLabel, createdAt);

    finalizeRoomCompletionAfterCheckin(db, roomRow, me, today);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const roomDetail = getRoomDetail(roomId, today, today)!;
  const checkin = roomDetail.checkins.find(c => c.id === checkinId)!;
  return { ok: true, checkin, room: roomDetail };
}

export function toggleCheckinLike(
  checkinId: string
): { ok: true; checkin: DailyCheckin } | { ok: false; status: 404; error: string } {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT c.*, m.nickname AS member_nickname, m.avatar_initial AS member_avatar_initial, m.is_current_user
       FROM daily_checkins c
       JOIN room_members m ON m.id = c.member_id
       WHERE c.id = ?`
    )
    .get(checkinId) as CheckinRow | undefined;

  if (!existing) {
    return { ok: false, status: 404, error: '인증 기록을 찾을 수 없어요.' };
  }

  const nextLiked = existing.liked_by_me === 1 ? 0 : 1;
  const nextCount = Math.max(0, existing.likes_count + (nextLiked === 1 ? 1 : -1));

  db.prepare(
    `UPDATE daily_checkins SET liked_by_me = ?, likes_count = ? WHERE id = ?`
  ).run(nextLiked, nextCount, checkinId);

  const updated = db
    .prepare(
      `SELECT c.*, m.nickname AS member_nickname, m.avatar_initial AS member_avatar_initial, m.is_current_user
       FROM daily_checkins c
       JOIN room_members m ON m.id = c.member_id
       WHERE c.id = ?`
    )
    .get(checkinId) as unknown as CheckinRow;

  return { ok: true, checkin: mapCheckin(updated) };
}

export function getAlbumEntries(params?: {
  month?: string;
  roomId?: string;
  today?: string;
}): AlbumResponse {
  const today = params?.today || getTodayKst();
  const db = getDb(today);
  const month = params?.month || today.slice(0, 7);
  const roomIdFilter = params?.roomId?.trim() || '';

  const monthRows = db
    .prepare(
      `SELECT DISTINCT substr(c.checkin_date, 1, 7) AS m
       FROM daily_checkins c
       JOIN room_members rm ON rm.id = c.member_id
       WHERE rm.is_current_user = 1
       ORDER BY m DESC`
    )
    .all() as { m: string }[];
  const availableMonths = [...new Set([today.slice(0, 7), ...monthRows.map(r => r.m)])].sort(
    (a, b) => b.localeCompare(a)
  );

  const roomRows = db
    .prepare(
      `SELECT r.id, r.title, r.tag
       FROM rooms r
       JOIN room_members rm ON rm.room_id = r.id
       WHERE rm.is_current_user = 1
       ORDER BY r.created_at DESC`
    )
    .all() as { id: string; title: string; tag: string }[];

  const rows = db
    .prepare(
      `SELECT c.id, c.room_id, r.title AS room_title, r.tag, c.checkin_date, c.status,
              c.image_data, c.note, c.timestamp_label, c.likes_count
       FROM daily_checkins c
       JOIN room_members rm ON rm.id = c.member_id
       JOIN rooms r ON r.id = c.room_id
       WHERE rm.is_current_user = 1
         AND substr(c.checkin_date, 1, 7) = ?
         ${roomIdFilter ? 'AND c.room_id = ?' : ''}
       ORDER BY c.checkin_date DESC, c.created_at DESC`
    )
    .all(...(roomIdFilter ? [month, roomIdFilter] : [month])) as {
    id: string;
    room_id: string;
    room_title: string;
    tag: string;
    checkin_date: string;
    status: 'photo' | 'rest';
    image_data: string | null;
    note: string;
    timestamp_label: string;
    likes_count: number;
  }[];

  const entries: AlbumEntry[] = rows.map(r => ({
    id: r.id,
    roomId: r.room_id,
    roomTitle: r.room_title,
    tag: r.tag,
    checkinDate: r.checkin_date,
    status: r.status,
    imageData: r.image_data,
    note: r.note,
    timestampLabel: r.timestamp_label,
    likesCount: r.likes_count,
  }));

  return {
    month,
    availableMonths,
    rooms: roomRows,
    entries,
  };
}

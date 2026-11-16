import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeAndResetDbCache } from '@/lib/db';
import {
  createRoom,
  getAlbumEntries,
  getRoomDetail,
  joinRoom,
  listRoomsOverview,
  submitPhotoCheckin,
  submitRestPass,
  toggleCheckinLike,
} from '@/lib/repository';

const TODAY = '2026-11-16'; // Monday
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ongi-repo-test-'));
  process.env.ONGI_DB_PATH = path.join(tmpDir, 'test.db');
  closeAndResetDbCache();
});

afterEach(() => {
  closeAndResetDbCache();
  delete process.env.ONGI_DB_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('SQLite seeding and room overview', () => {
  it('auto-seeds 3 joined rooms, 4 explore rooms, and 7-day week rhythm', () => {
    const overview = listRoomsOverview({ today: TODAY });

    expect(overview.myRooms).toHaveLength(3);
    const workout = overview.myRooms.find(r => r.title === '저녁 운동 메이트');
    const reading = overview.myRooms.find(r => r.title === '밤 10시 차분한 독서방');
    const coding = overview.myRooms.find(r => r.title === '퇴근 후 사이드 작업실');

    expect(workout?.completionPercent).toBe(75);
    expect(workout?.streakDays).toBe(12);
    expect(workout?.myStatusToday).toBe('pending');

    expect(reading?.completionPercent).toBe(100);
    expect(reading?.myStatusToday).toBe('photo');

    expect(coding?.completionPercent).toBe(33);
    expect(coding?.myStatusToday).toBe('pending');

    expect(overview.exploreRooms.length).toBe(4);
    expect(overview.exploreRooms[0].maxCapacity - overview.exploreRooms[0].memberCount).toBe(1);
    expect(overview.weekRhythm).toHaveLength(7);
  });

  it('creates a new custom room with normalized tag and single layout', () => {
    const detail = createRoom(
      {
        title: '매일 저녁 영어 원서 3쪽',
        tag: '영어원서',
        category: 'reading',
        maxCapacity: 4,
      },
      TODAY
    );

    expect(detail.room.tag).toBe('#영어원서');
    expect(detail.layoutMode).toBe('single');
    expect(detail.members).toHaveLength(1);
    expect(detail.members[0].isHost).toBe(true);
    expect(detail.members[0].isCurrentUser).toBe(true);
    expect(detail.sameTagInspiration.length).toBeGreaterThan(0);
  });
});

describe('joinRoom (Review Focus #2)', () => {
  it('joins an open explore room and rejects full or already-joined rooms with 409', () => {
    const overview = listRoomsOverview({ today: TODAY });
    const fullRoom = overview.myRooms.find(r => r.title === '밤 10시 차분한 독서방')!;
    const alreadyJoined = overview.myRooms.find(r => r.title === '저녁 운동 메이트')!;
    const openRoom = overview.exploreRooms[0];

    expect(joinRoom(fullRoom.id, TODAY)).toMatchObject({ ok: false, status: 409 });
    expect(joinRoom(alreadyJoined.id, TODAY)).toMatchObject({ ok: false, status: 409 });
    expect(joinRoom('non-existent', TODAY)).toMatchObject({ ok: false, status: 404 });

    const joined = joinRoom(openRoom.id, TODAY);
    expect(joined.ok).toBe(true);
    if (joined.ok) {
      expect(joined.room.members.some(m => m.isCurrentUser)).toBe(true);
    }
  });
});

describe('submitPhotoCheckin & streak guard (Review Focus #1 & #4)', () => {
  it('completes 4-member room to 100%, increments streak 12->13 once, and rejects same-day duplicates', () => {
    const overview = listRoomsOverview({ today: TODAY });
    const workout = overview.myRooms.find(r => r.title === '저녁 운동 메이트')!;

    expect(
      submitPhotoCheckin(workout.id, { imageData: '', note: 'empty' }, TODAY)
    ).toMatchObject({ ok: false, status: 400 });

    const res = submitPhotoCheckin(
      workout.id,
      { imageData: 'data:image/jpeg;base64,abc123', note: '스쿼트 완료!', timestampLabel: '09:45 PM' },
      TODAY
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.room.completion.percent).toBe(100);
      expect(res.room.room.streakDays).toBe(13);
      expect(res.room.myStatusOnSelectedDate).toBe('photo');
    }

    // Same-day duplicate photo or rest must be rejected with 409 and preserve streak 13
    expect(
      submitPhotoCheckin(
        workout.id,
        { imageData: 'data:image/jpeg;base64,xyz', note: '또 올림' },
        TODAY
      )
    ).toMatchObject({ ok: false, status: 409 });
    expect(submitRestPass(workout.id, TODAY)).toMatchObject({ ok: false, status: 409 });
    expect(getRoomDetail(workout.id, TODAY, TODAY)?.room.streakDays).toBe(13);
  });
});

describe('submitRestPass weekly limit (Review Focus #3 & #4)', () => {
  it('allows one rest pass per Monday-Sunday week per room and rejects second rest pass in same week', () => {
    const overview = listRoomsOverview({ today: TODAY });
    const coding = overview.myRooms.find(r => r.title === '퇴근 후 사이드 작업실')!;

    const monRest = submitRestPass(coding.id, TODAY); // 2026-11-16 (Monday)
    expect(monRest.ok).toBe(true);
    if (monRest.ok) {
      expect(monRest.checkin.status).toBe('rest');
      expect(monRest.room.restPassesLeftThisWeek).toBe(0);
    }

    // Same day photo check-in is blocked (409)
    expect(
      submitPhotoCheckin(
        coding.id,
        { imageData: 'data:image/jpeg;base64,abc', note: 'same day' },
        TODAY
      )
    ).toMatchObject({ ok: false, status: 409 });

    // Next day in same week (Tuesday 2026-11-17) second rest pass is blocked (400)
    expect(submitRestPass(coding.id, '2026-11-17')).toMatchObject({ ok: false, status: 400 });

    // Next Monday (2026-11-23) allows a fresh weekly rest pass
    const nextWeekDetail = getRoomDetail(coding.id, '2026-11-23', '2026-11-23');
    expect(nextWeekDetail?.restPassesLeftThisWeek).toBe(1);
  });
});

describe('likes, history, and album', () => {
  it('toggles checkin likes and filters user album entries by month and room', () => {
    const overview = listRoomsOverview({ today: TODAY });
    const workout = overview.myRooms.find(r => r.title === '저녁 운동 메이트')!;
    const detail = getRoomDetail(workout.id, TODAY, TODAY)!;

    expect(detail.availableDates.length).toBeGreaterThanOrEqual(3);
    const firstTile = detail.checkins[0];
    const toggled = toggleCheckinLike(firstTile.id);
    expect(toggled.ok).toBe(true);
    if (toggled.ok) {
      expect(toggled.checkin.likedByMe).toBe(!firstTile.likedByMe);
      expect(toggled.checkin.likesCount).toBe(
        firstTile.likedByMe ? firstTile.likesCount - 1 : firstTile.likesCount + 1
      );
    }

    const albumAll = getAlbumEntries({ month: '2026-11', today: TODAY });
    expect(albumAll.entries.length).toBeGreaterThanOrEqual(3);

    const reading = overview.myRooms.find(r => r.title === '밤 10시 차분한 독서방')!;
    const albumFiltered = getAlbumEntries({ month: '2026-11', roomId: reading.id, today: TODAY });
    expect(albumFiltered.entries.every(e => e.roomId === reading.id)).toBe(true);
  });
});

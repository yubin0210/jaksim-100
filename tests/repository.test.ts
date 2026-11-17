import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryOngiStore } from '@/lib/store-memory';
import {
  createRoom,
  getAlbumEntries,
  getRoomDetail,
  joinRoom,
  listRoomsOverview,
  submitPhotoCheckin,
  submitRestPass,
  toggleCheckinLike,
  type OngiStore,
} from '@/lib/repository';
import type { UserProfile } from '@/types/ongi';

const TODAY = '2026-11-16'; // Monday
const VALID_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAA==';

const userA: UserProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'minji@ongi.app',
  nickname: '민지',
  avatarInitial: '민',
};

const userB: UserProfile = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'jihoon@ongi.app',
  nickname: '지훈',
  avatarInitial: '지',
};

const userC: UserProfile = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'seoyeon@ongi.app',
  nickname: '서연',
  avatarInitial: '서',
};

let store: OngiStore;

beforeEach(() => {
  store = createInMemoryOngiStore();
});

describe('Clean empty start & multi-user room lifecycle', () => {
  it('starts completely empty with zero fake seed data', async () => {
    const overview = await listRoomsOverview(userA, { today: TODAY }, store);

    expect(overview.myRooms).toEqual([]);
    expect(overview.exploreRooms).toEqual([]);
    expect(overview.weekRhythm).toHaveLength(7);
    expect(overview.weekRhythm.every(d => d.done === false)).toBe(true);
  });

  it('creates rooms, exposes open rooms to other users, and enforces capacity/duplicate 409 guards', async () => {
    const created = await createRoom(
      userA,
      { title: '저녁 운동 메이트', tag: '오운완', maxCapacity: 2 },
      TODAY,
      store
    );

    expect(created.room.tag).toBe('#오운완');
    expect(created.isJoined).toBe(true);
    expect(created.members).toHaveLength(1);
    expect(created.members[0].isHost).toBe(true);
    expect(created.members[0].isCurrentUser).toBe(true);

    // User B sees User A's room in exploreRooms and can preview it with isJoined: false
    const overviewB = await listRoomsOverview(userB, { today: TODAY }, store);
    expect(overviewB.myRooms).toEqual([]);
    expect(overviewB.exploreRooms).toHaveLength(1);

    const previewB = await getRoomDetail(userB, created.room.id, TODAY, TODAY, store);
    expect(previewB?.isJoined).toBe(false);
    expect(previewB?.members.every(m => !m.isCurrentUser)).toBe(true);

    // Duplicate join by User A -> 409
    await expect(joinRoom(userA, created.room.id, TODAY, store)).resolves.toMatchObject({
      ok: false,
      status: 409,
    });

    // User B joins -> 200
    const joinedB = await joinRoom(userB, created.room.id, TODAY, store);
    expect(joinedB.ok).toBe(true);
    if (joinedB.ok) {
      expect(joinedB.room.isJoined).toBe(true);
      expect(joinedB.room.members).toHaveLength(2);
    }

    // User C attempts to join full 2/2 room -> 409
    await expect(joinRoom(userC, created.room.id, TODAY, store)).resolves.toMatchObject({
      ok: false,
      status: 409,
    });
  });
});

describe('Photo check-in storage upload, streak guard & multi-user likes', () => {
  it('validates image format, uploads JPEG to storage URL, increments streak once on 100%, and tracks per-user likes', async () => {
    const created = await createRoom(
      userA,
      { title: '밤 10시 독서방', tag: '#독서', maxCapacity: 2 },
      TODAY,
      store
    );
    await joinRoom(userB, created.room.id, TODAY, store);

    // Reject empty or non-image data URL
    await expect(
      submitPhotoCheckin(userA, created.room.id, { imageData: '', note: '빈 사진' }, TODAY, store)
    ).resolves.toMatchObject({ ok: false, status: 400 });
    await expect(
      submitPhotoCheckin(
        userA,
        created.room.id,
        { imageData: 'https://evil.example.com/fake.jpg', note: 'URL 직접 입력' },
        TODAY,
        store
      )
    ).resolves.toMatchObject({ ok: false, status: 400 });

    // User A submits JPEG -> 50%, streak still 0
    const chkA = await submitPhotoCheckin(
      userA,
      created.room.id,
      { imageData: VALID_JPEG, note: '15쪽 완독', timestampLabel: '09:30 PM' },
      TODAY,
      store
    );
    expect(chkA.ok).toBe(true);
    if (chkA.ok) {
      expect(chkA.checkin.imageData).toMatch(/^https?:\/\/|^\/mock-storage\//);
      expect(chkA.room.completion.percent).toBe(50);
      expect(chkA.room.room.streakDays).toBe(0);
    }

    // Same-day duplicate check-in by User A -> 409
    await expect(
      submitPhotoCheckin(
        userA,
        created.room.id,
        { imageData: VALID_JPEG, note: '재업로드' },
        TODAY,
        store
      )
    ).resolves.toMatchObject({ ok: false, status: 409 });

    // User B submits JPEG -> 100%, streak increments 0 -> 1
    const chkB = await submitPhotoCheckin(
      userB,
      created.room.id,
      { imageData: VALID_JPEG, note: '필사 10분', timestampLabel: '10:05 PM' },
      TODAY,
      store
    );
    expect(chkB.ok).toBe(true);
    if (chkB.ok) {
      expect(chkB.room.completion.percent).toBe(100);
      expect(chkB.room.room.streakDays).toBe(1);
    }

    // Multi-user independent likes on User A's checkin
    if (chkA.ok) {
      const likeByB = await toggleCheckinLike(userB, chkA.checkin.id, store);
      expect(likeByB).toMatchObject({
        ok: true,
        checkin: { likesCount: 1, likedByMe: true },
      });

      // User A still sees likedByMe: false while likesCount: 1
      const detailForA = await getRoomDetail(userA, created.room.id, TODAY, TODAY, store);
      const tileForA = detailForA?.checkins.find(c => c.id === chkA.checkin.id);
      expect(tileForA?.likesCount).toBe(1);
      expect(tileForA?.likedByMe).toBe(false);

      const likeByA = await toggleCheckinLike(userA, chkA.checkin.id, store);
      expect(likeByA).toMatchObject({
        ok: true,
        checkin: { likesCount: 2, likedByMe: true },
      });
    }
  });
});

describe('Post-eviction preservation & same-week constraints (Review Focus #2 & #3)', () => {
  it('evicts inactive member with protectCurrentUser: false, transfers host, and preserves /album, weekRhythm, and past board tiles', async () => {
    const day0 = '2026-11-16'; // Monday
    const day1 = '2026-11-17'; // Tuesday
    const day5 = '2026-11-21'; // Saturday (day0 <= day5-3='2026-11-18' and lastActive < '2026-11-18')

    const created = await createRoom(
      userA,
      { title: '새벽 기상', tag: '#미라클모닝', maxCapacity: 4 },
      day0,
      store
    );
    await joinRoom(userB, created.room.id, day0, store);

    // User A (host) checks in on day0, then goes inactive through day5
    await submitPhotoCheckin(
      userA,
      created.room.id,
      { imageData: VALID_JPEG, note: '첫날 기상 성공' },
      day0,
      store
    );

    // Keep User B active on day3 ('2026-11-19') so only User A is evicted on day5
    await submitPhotoCheckin(
      userB,
      created.room.id,
      { imageData: VALID_JPEG, note: '계속 출석 중' },
      '2026-11-19',
      store
    );

    // User A opens room/overview on day5 -> protectCurrentUser is false, so User A is evicted and User B becomes host
    const detailDay5 = await getRoomDetail(userA, created.room.id, day5, day5, store);
    expect(detailDay5?.members).toHaveLength(1);
    expect(detailDay5?.members[0].userId).toBe(userB.id);
    expect(detailDay5?.members[0].isHost).toBe(true);
    expect(detailDay5?.isJoined).toBe(false);

    // User A's past check-in on day0 is preserved in past-date board view
    const pastBoard = await getRoomDetail(userB, created.room.id, day0, day5, store);
    expect(pastBoard?.checkins).toHaveLength(1);
    expect(pastBoard?.checkins[0].memberId).toBeNull();
    expect(pastBoard?.checkins[0].memberNickname).toBe('민지');

    // User A's personal /album and weekRhythm still contain day0 check-in
    const albumA = await getAlbumEntries(userA, { month: '2026-11', today: day5 }, store);
    expect(albumA.entries).toHaveLength(1);
    expect(albumA.entries[0].note).toBe('첫날 기상 성공');

    const overviewA = await listRoomsOverview(userA, { today: day5 }, store);
    const mon = overviewA.weekRhythm.find(d => d.date === day0);
    expect(mon?.done).toBe(true);
    expect(day1).toBe('2026-11-17');
  });

  it('enforces once-per-week rest pass and same-day check-in uniqueness across eviction and re-join', async () => {
    const day0 = '2026-11-16'; // Monday
    const day4 = '2026-11-20'; // Friday (same Mon-Sun week)

    const created = await createRoom(
      userA,
      { title: '주간 러닝방', tag: '#러닝', maxCapacity: 4 },
      day0,
      store
    );
    await joinRoom(userB, created.room.id, day0, store);

    // User A uses weekly rest pass on Monday
    const restRes = await submitRestPass(userA, created.room.id, day0, store);
    expect(restRes.ok).toBe(true);

    // Same-day photo attempt -> 409
    await expect(
      submitPhotoCheckin(
        userA,
        created.room.id,
        { imageData: VALID_JPEG, note: '같은 날 재시도' },
        day0,
        store
      )
    ).resolves.toMatchObject({ ok: false, status: 409 });

    // User B stays active on Wednesday so User A gets evicted on Friday (day0 < 2026-11-17)
    await submitPhotoCheckin(
      userB,
      created.room.id,
      { imageData: VALID_JPEG, note: '수요일 러닝' },
      '2026-11-18',
      store
    );

    // Trigger eviction on Friday and let User A re-join the same room in the same week
    const rejoin = await joinRoom(userA, created.room.id, day4, store);
    expect(rejoin.ok).toBe(true);
    if (rejoin.ok) {
      expect(rejoin.room.restPassesLeftThisWeek).toBe(0);
    }

    // Second rest pass in same Mon-Sun week after re-joining -> 400
    await expect(
      submitRestPass(userA, created.room.id, day4, store)
    ).resolves.toMatchObject({ ok: false, status: 400 });
  });
});

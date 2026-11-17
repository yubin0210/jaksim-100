import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resetTestUserOverride,
  setTestUserOverride,
} from '@/lib/auth';
import { createInMemoryOngiStore } from '@/lib/store-memory';
import {
  resetTestStoreOverride,
  setTestStoreOverride,
} from '@/lib/repository';
import { GET as getRooms, POST as postRooms } from '@/app/api/rooms/route';
import { GET as getRoomById } from '@/app/api/rooms/[id]/route';
import { POST as postJoinRoom } from '@/app/api/rooms/[id]/join/route';
import { POST as postCheckin } from '@/app/api/rooms/[id]/checkin/route';
import { POST as postRest } from '@/app/api/rooms/[id]/rest/route';
import { POST as postLike } from '@/app/api/checkins/[id]/like/route';
import { GET as getAlbum } from '@/app/api/album/route';
import type { UserProfile } from '@/types/ongi';

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

beforeEach(() => {
  setTestStoreOverride(createInMemoryOngiStore());
  setTestUserOverride(userA);
});

afterEach(() => {
  resetTestStoreOverride();
  resetTestUserOverride();
});

describe('Unauthenticated 401 guards across all API endpoints (Review Focus #1)', () => {
  it('returns 401 JSON for every protected route when user is null', async () => {
    setTestUserOverride(null);

    expect(
      (await getRooms(new Request('http://localhost:3000/api/rooms'))).status
    ).toBe(401);
    expect(
      (
        await postRooms(
          new Request('http://localhost:3000/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: '아침', tag: '루틴', maxCapacity: 2 }),
          })
        )
      ).status
    ).toBe(401);
    expect(
      (
        await getRoomById(new Request('http://localhost:3000/api/rooms/r1'), {
          params: Promise.resolve({ id: 'r1' }),
        })
      ).status
    ).toBe(401);
    expect(
      (
        await postJoinRoom(
          new Request('http://localhost:3000/api/rooms/r1/join', {
            method: 'POST',
          }),
          { params: Promise.resolve({ id: 'r1' }) }
        )
      ).status
    ).toBe(401);
    expect(
      (
        await postCheckin(
          new Request('http://localhost:3000/api/rooms/r1/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: VALID_JPEG, note: 'hi' }),
          }),
          { params: Promise.resolve({ id: 'r1' }) }
        )
      ).status
    ).toBe(401);
    expect(
      (
        await postRest(
          new Request('http://localhost:3000/api/rooms/r1/rest', {
            method: 'POST',
          }),
          { params: Promise.resolve({ id: 'r1' }) }
        )
      ).status
    ).toBe(401);
    expect(
      (
        await postLike(
          new Request('http://localhost:3000/api/checkins/c1/like', {
            method: 'POST',
          }),
          { params: Promise.resolve({ id: 'c1' }) }
        )
      ).status
    ).toBe(401);
    expect(
      (await getAlbum(new Request('http://localhost:3000/api/album'))).status
    ).toBe(401);
  });
});

describe('Multi-user REST API workflows (Review Focus #5)', () => {
  it('supports room creation, preview, capacity join, JPEG validation, likes, rest pass, and per-user album isolation', async () => {
    const emptyList = await getRooms(
      new Request('http://localhost:3000/api/rooms')
    );
    expect(emptyList.status).toBe(200);
    expect(await emptyList.json()).toMatchObject({
      myRooms: [],
      exploreRooms: [],
    });

    const badCreate = await postRooms(
      new Request('http://localhost:3000/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '  ', tag: '#독서' }),
      })
    );
    expect(badCreate.status).toBe(400);

    // User A creates 2-member room
    const createdRes = await postRooms(
      new Request('http://localhost:3000/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '아침 10분 명상',
          tag: '명상',
          maxCapacity: 2,
        }),
      })
    );
    expect(createdRes.status).toBe(201);
    const createdJson = await createdRes.json();
    const roomId = createdJson.room.room.id as string;

    // Unknown room -> 404
    const missing = await getRoomById(
      new Request('http://localhost:3000/api/rooms/unknown'),
      { params: Promise.resolve({ id: 'unknown' }) }
    );
    expect(missing.status).toBe(404);

    // User B previews room (isJoined: false) then joins (200)
    setTestUserOverride(userB);
    const previewRes = await getRoomById(
      new Request(`http://localhost:3000/api/rooms/${roomId}`),
      { params: Promise.resolve({ id: roomId }) }
    );
    expect(previewRes.status).toBe(200);
    expect((await previewRes.json()).isJoined).toBe(false);

    const joinOk = await postJoinRoom(
      new Request(`http://localhost:3000/api/rooms/${roomId}/join`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: roomId }) }
    );
    expect(joinOk.status).toBe(200);
    expect((await joinOk.json()).room.isJoined).toBe(true);

    // User C attempts to join full 2/2 room -> 409
    setTestUserOverride(userC);
    const joinFull = await postJoinRoom(
      new Request(`http://localhost:3000/api/rooms/${roomId}/join`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: roomId }) }
    );
    expect(joinFull.status).toBe(409);

    // User A validates bad imageData -> 400, valid JPEG -> 201, duplicate -> 409
    setTestUserOverride(userA);
    const badCheckin = await postCheckin(
      new Request(`http://localhost:3000/api/rooms/${roomId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: 'not-a-data-url', note: '잘못된 이미지' }),
      }),
      { params: Promise.resolve({ id: roomId }) }
    );
    expect(badCheckin.status).toBe(400);

    const okCheckinA = await postCheckin(
      new Request(`http://localhost:3000/api/rooms/${roomId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: VALID_JPEG,
          note: '호흡 10분 완료',
          timestampLabel: '07:30 AM',
        }),
      }),
      { params: Promise.resolve({ id: roomId }) }
    );
    expect(okCheckinA.status).toBe(201);
    const checkinAJson = await okCheckinA.json();
    const checkinIdA = checkinAJson.checkin.id as string;

    const dupCheckinA = await postCheckin(
      new Request(`http://localhost:3000/api/rooms/${roomId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: VALID_JPEG, note: '중복' }),
      }),
      { params: Promise.resolve({ id: roomId }) }
    );
    expect(dupCheckinA.status).toBe(409);

    // User B toggles like on A's checkin and submits photo -> 100%, streak = 1
    setTestUserOverride(userB);
    const likeRes = await postLike(
      new Request(`http://localhost:3000/api/checkins/${checkinIdA}/like`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: checkinIdA }) }
    );
    expect(likeRes.status).toBe(200);
    expect(await likeRes.json()).toMatchObject({
      checkin: { id: checkinIdA, likesCount: 1, likedByMe: true },
    });

    const okCheckinB = await postCheckin(
      new Request(`http://localhost:3000/api/rooms/${roomId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: VALID_JPEG,
          note: '나도 완료!',
          timestampLabel: '08:00 AM',
        }),
      }),
      { params: Promise.resolve({ id: roomId }) }
    );
    expect(okCheckinB.status).toBe(201);
    expect((await okCheckinB.json()).room.room.streakDays).toBe(1);

    // Album isolation: User A sees only A's checkin, User C sees empty album
    setTestUserOverride(userA);
    const albumA = await (
      await getAlbum(new Request('http://localhost:3000/api/album'))
    ).json();
    expect(albumA.entries).toHaveLength(1);
    expect(albumA.entries[0].note).toBe('호흡 10분 완료');

    setTestUserOverride(userC);
    const albumC = await (
      await getAlbum(new Request('http://localhost:3000/api/album'))
    ).json();
    expect(albumC.entries).toEqual([]);

    // User C creates a second room and uses rest pass -> 201, same-day checkin -> 409
    const room2Res = await postRooms(
      new Request('http://localhost:3000/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '저녁 스트레칭', tag: '스트레칭', maxCapacity: 2 }),
      })
    );
    const room2Id = (await room2Res.json()).room.room.id as string;
    const restRes = await postRest(
      new Request(`http://localhost:3000/api/rooms/${room2Id}/rest`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: room2Id }) }
    );
    expect(restRes.status).toBe(201);

    const sameDayAfterRest = await postCheckin(
      new Request(`http://localhost:3000/api/rooms/${room2Id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: VALID_JPEG, note: '중복' }),
      }),
      { params: Promise.resolve({ id: room2Id }) }
    );
    expect(sameDayAfterRest.status).toBe(409);
  });
});

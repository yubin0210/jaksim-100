import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeAndResetDbCache } from '@/lib/db';
import { GET as getRooms, POST as postRooms } from '@/app/api/rooms/route';
import { GET as getRoomById } from '@/app/api/rooms/[id]/route';
import { POST as postJoinRoom } from '@/app/api/rooms/[id]/join/route';
import { POST as postCheckin } from '@/app/api/rooms/[id]/checkin/route';
import { POST as postRest } from '@/app/api/rooms/[id]/rest/route';
import { POST as postLike } from '@/app/api/checkins/[id]/like/route';
import { GET as getAlbum } from '@/app/api/album/route';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ongi-api-test-'));
  process.env.ONGI_DB_PATH = path.join(tmpDir, 'api-test.db');
  closeAndResetDbCache();
});

afterEach(() => {
  closeAndResetDbCache();
  delete process.env.ONGI_DB_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('REST API routes', () => {
  it('GET /api/rooms & POST /api/rooms list, filter, validate, and create rooms', async () => {
    const res = await getRooms(new Request('http://localhost:3000/api/rooms?filter=almost'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.myRooms).toHaveLength(3);
    expect(body.exploreRooms.every((r: { maxCapacity: number; memberCount: number }) => r.maxCapacity - r.memberCount === 1)).toBe(true);
    expect(body.weekRhythm).toHaveLength(7);

    const badCreate = await postRooms(
      new Request('http://localhost:3000/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '  ', tag: '#독서' }),
      })
    );
    expect(badCreate.status).toBe(400);

    const createdRes = await postRooms(
      new Request('http://localhost:3000/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '아침 10분 명상', tag: '명상', maxCapacity: 2 }),
      })
    );
    expect(createdRes.status).toBe(201);
    const createdJson = await createdRes.json();
    expect(createdJson.room.room.tag).toBe('#명상');
    expect(createdJson.room.room.maxCapacity).toBe(2);
  });

  it('GET /api/rooms/[id] and POST /api/rooms/[id]/join handle valid, missing, and full rooms', async () => {
    const missing = await getRoomById(new Request('http://localhost:3000/api/rooms/unknown'), {
      params: Promise.resolve({ id: 'unknown' }),
    });
    expect(missing.status).toBe(404);

    const listRes = await getRooms(new Request('http://localhost:3000/api/rooms'));
    const { myRooms, exploreRooms } = await listRes.json();
    const fullRoom = myRooms.find((r: { title: string }) => r.title === '밤 10시 차분한 독서방');
    const openRoom = exploreRooms[0];

    const joinFull = await postJoinRoom(
      new Request(`http://localhost:3000/api/rooms/${fullRoom.id}/join`, { method: 'POST' }),
      { params: Promise.resolve({ id: fullRoom.id }) }
    );
    expect(joinFull.status).toBe(409);

    const joinOk = await postJoinRoom(
      new Request(`http://localhost:3000/api/rooms/${openRoom.id}/join`, { method: 'POST' }),
      { params: Promise.resolve({ id: openRoom.id }) }
    );
    expect(joinOk.status).toBe(200);
    const joinedJson = await joinOk.json();
    expect(joinedJson.room.members.some((m: { isCurrentUser: boolean }) => m.isCurrentUser)).toBe(true);
  });

  it('POST /api/rooms/[id]/checkin and /rest enforce validation, exclusivity, and weekly limit', async () => {
    const listRes = await getRooms(new Request('http://localhost:3000/api/rooms'));
    const { myRooms } = await listRes.json();
    const workout = myRooms.find((r: { title: string }) => r.title === '저녁 운동 메이트');
    const coding = myRooms.find((r: { title: string }) => r.title === '퇴근 후 사이드 작업실');

    const badCheckin = await postCheckin(
      new Request(`http://localhost:3000/api/rooms/${workout.id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: '', note: '빈 사진' }),
      }),
      { params: Promise.resolve({ id: workout.id }) }
    );
    expect(badCheckin.status).toBe(400);

    const okCheckin = await postCheckin(
      new Request(`http://localhost:3000/api/rooms/${workout.id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: 'data:image/jpeg;base64,testimg',
          note: '오늘 운동 완료!',
          timestampLabel: '09:45 PM',
        }),
      }),
      { params: Promise.resolve({ id: workout.id }) }
    );
    expect(okCheckin.status).toBe(201);
    const okJson = await okCheckin.json();
    expect(okJson.room.completion.percent).toBe(100);
    expect(okJson.room.room.streakDays).toBe(13);

    const dupRestSameDay = await postRest(
      new Request(`http://localhost:3000/api/rooms/${workout.id}/rest`, { method: 'POST' }),
      { params: Promise.resolve({ id: workout.id }) }
    );
    expect(dupRestSameDay.status).toBe(409);

    const okRest = await postRest(
      new Request(`http://localhost:3000/api/rooms/${coding.id}/rest`, { method: 'POST' }),
      { params: Promise.resolve({ id: coding.id }) }
    );
    expect(okRest.status).toBe(201);
    const restJson = await okRest.json();
    expect(restJson.checkin.status).toBe('rest');
    expect(restJson.room.restPassesLeftThisWeek).toBe(0);
  });

  it('POST /api/checkins/[id]/like and GET /api/album operate correctly', async () => {
    const detailRes = await getRoomById(new Request('http://localhost:3000/api/rooms/room-workout'), {
      params: Promise.resolve({ id: 'room-workout' }),
    });
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    const firstCheckin = detail.checkins[0];

    const likeRes = await postLike(
      new Request(`http://localhost:3000/api/checkins/${firstCheckin.id}/like`, { method: 'POST' }),
      { params: Promise.resolve({ id: firstCheckin.id }) }
    );
    expect(likeRes.status).toBe(200);
    const likedJson = await likeRes.json();
    expect(likedJson.checkin.likedByMe).toBe(!firstCheckin.likedByMe);

    const missingLike = await postLike(
      new Request('http://localhost:3000/api/checkins/nope/like', { method: 'POST' }),
      { params: Promise.resolve({ id: 'nope' }) }
    );
    expect(missingLike.status).toBe(404);

    const albumRes = await getAlbum(new Request('http://localhost:3000/api/album?roomId=room-reading'));
    expect(albumRes.status).toBe(200);
    const albumJson = await albumRes.json();
    expect(albumJson.entries.length).toBeGreaterThan(0);
    expect(albumJson.entries.every((e: { roomId: string }) => e.roomId === 'room-reading')).toBe(true);
  });
});

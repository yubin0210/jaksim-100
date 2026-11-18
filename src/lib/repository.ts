import crypto from 'node:crypto';
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
import { createSupabaseOngiStore } from '@/lib/store-supabase';
import type {
  AlbumEntry,
  AlbumResponse,
  CheckinStatus,
  DailyCheckin,
  InspirationSnippet,
  PreviewTile,
  Room,
  RoomCapacity,
  RoomDetailResponse,
  RoomMember,
  RoomSummary,
  UserProfile,
  WeekRhythmDay,
} from '@/types/ongi';

export interface OngiStore {
  listAllRooms(): Promise<Room[]>;
  getRoomById(roomId: string): Promise<Room | null>;
  createRoomWithHost(params: {
    room: Room;
    hostMember: Omit<RoomMember, 'isCurrentUser'>;
    createdBy: string;
  }): Promise<void>;
  listActiveMembers(
    roomId: string | undefined,
    currentUserId: string
  ): Promise<RoomMember[]>;
  applyEviction(params: {
    roomId: string;
    evictedIds: string[];
    newHostMemberId: string | null;
  }): Promise<void>;
  joinRoomAtomic(params: {
    roomId: string;
    memberId: string;
    user: UserProfile;
    today: string;
  }): Promise<{ ok: true } | { ok: false; status: 404 | 409; error: string }>;
  listCheckinsForRoomsDate(params: {
    roomIds: string[];
    dateStr: string;
    currentUserId: string;
  }): Promise<DailyCheckin[]>;
  listCheckinDatesForRoom(roomId: string): Promise<string[]>;
  countRestPassesUsedInRange(params: {
    roomId: string;
    userId: string;
    startDate: string;
    endDate: string;
  }): Promise<number>;
  hasUserCheckinOnDate(params: {
    roomId: string;
    userId: string;
    dateStr: string;
  }): Promise<boolean>;
  listUserActiveDatesInRange(params: {
    userId: string;
    startDate: string;
    endDate: string;
  }): Promise<string[]>;
  uploadCheckinImage(params: {
    userId: string;
    roomId: string;
    checkinId: string;
    bytes: Uint8Array;
    contentType: string;
    ext: string;
  }): Promise<string>;
  insertCheckin(params: {
    id: string;
    roomId: string;
    memberId: string;
    userId: string;
    authorNickname: string;
    authorAvatarInitial: string;
    checkinDate: string;
    status: CheckinStatus;
    imageData: string | null;
    note: string;
    timestampLabel: string;
    createdAt: string;
  }): Promise<{ ok: true } | { ok: false; status: 409; error: string }>;
  applyCheckinStreak(params: {
    roomId: string;
    memberId: string;
    memberStreakDays: number;
    today: string;
    roomStreakDays: number;
    lastCompletedDate: string | null;
  }): Promise<void>;
  toggleLike(params: {
    checkinId: string;
    userId: string;
  }): Promise<
    { ok: true; checkin: DailyCheckin } | { ok: false; status: 404; error: string }
  >;
  listUserAlbumData(params: {
    userId: string;
    month: string;
    roomId?: string;
  }): Promise<{
    availableMonths: string[];
    rooms: { id: string; title: string; tag: string }[];
    entries: AlbumEntry[];
  }>;
  listSameTagSnippets(params: {
    excludeRoomId: string;
    tag: string;
    category: string;
    today: string;
  }): Promise<InspirationSnippet[]>;
}

const g = globalThis as unknown as { __ongiTestStoreOverride?: OngiStore };

export function setTestStoreOverride(store: OngiStore | undefined): void {
  g.__ongiTestStoreOverride = store;
}

export function resetTestStoreOverride(): void {
  g.__ongiTestStoreOverride = undefined;
}

function resolveStore(storeOverride?: OngiStore): OngiStore {
  return storeOverride ?? g.__ongiTestStoreOverride ?? createSupabaseOngiStore();
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

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export function parseCheckinImageData(
  imageData: string
): { bytes: Uint8Array; contentType: string; ext: string } | null {
  const trimmed = imageData.trim();
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    trimmed
  );
  if (!match) return null;

  const rawMime = match[1];
  const base64Body = match[2];
  const bytes = Buffer.from(base64Body, 'base64');
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return null;
  }

  const contentType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
  const ext =
    contentType === 'image/png'
      ? 'png'
      : contentType === 'image/webp'
        ? 'webp'
        : 'jpg';

  return { bytes: new Uint8Array(bytes), contentType, ext };
}

async function syncRoomEvictions(
  store: OngiStore,
  roomId: string,
  members: RoomMember[],
  today: string
): Promise<RoomMember[]> {
  if (members.length <= 1) return members;

  const { evictedIds, newHostMemberId, kept } = evaluateInactiveEvictions({
    members,
    today,
    protectCurrentUser: false,
  });

  if (evictedIds.length === 0) return members;

  await store.applyEviction({
    roomId,
    evictedIds,
    newHostMemberId,
  });

  return kept;
}

export async function listRoomsOverview(
  user: UserProfile,
  params?: { today?: string; query?: string; filter?: string },
  storeOverride?: OngiStore
): Promise<{
  myRooms: RoomSummary[];
  exploreRooms: RoomSummary[];
  weekRhythm: WeekRhythmDay[];
}> {
  const store = resolveStore(storeOverride);
  const today = params?.today || getTodayKst();

  const [allRooms, allMembers] = await Promise.all([
    store.listAllRooms(),
    store.listActiveMembers(undefined, user.id),
  ]);

  const roomIds = allRooms.map(r => r.id);
  const monday = getMondayOfWeek(today);
  const sunday = shiftDate(monday, 6);

  const [todayCheckins, userActiveDates] = await Promise.all([
    store.listCheckinsForRoomsDate({
      roomIds,
      dateStr: today,
      currentUserId: user.id,
    }),
    store.listUserActiveDatesInRange({
      userId: user.id,
      startDate: monday,
      endDate: sunday,
    }),
  ]);

  const membersByRoom = new Map<string, RoomMember[]>();
  for (const m of allMembers) {
    const list = membersByRoom.get(m.roomId) ?? [];
    list.push(m);
    membersByRoom.set(m.roomId, list);
  }

  const checkinsByRoom = new Map<string, DailyCheckin[]>();
  for (const c of todayCheckins) {
    const list = checkinsByRoom.get(c.roomId) ?? [];
    list.push(c);
    checkinsByRoom.set(c.roomId, list);
  }

  const summaries: RoomSummary[] = await Promise.all(
    allRooms.map(async room => {
      const rawMembers = membersByRoom.get(room.id) ?? [];
      const members = await syncRoomEvictions(store, room.id, rawMembers, today);
      const checkins = checkinsByRoom.get(room.id) ?? [];
      const me = members.find(m => m.isCurrentUser);
      const myCheckin = checkins.find(c => c.userId === user.id);

      const stats = computeCompletionStats(members.length, checkins.length);
      const streakInfo = computeNextRoomStreak({
        currentStreak: room.streakDays,
        lastCompletedDate: room.lastCompletedDate,
        today,
        isRoomCompleteToday: stats.isComplete,
      });

      const checkinByUser = new Map(checkins.map(c => [c.userId, c]));
      const previewTiles: PreviewTile[] = members.map(m => {
        const ch = checkinByUser.get(m.userId);
        if (!ch) return { status: 'empty', imageData: null, nickname: m.nickname };
        return {
          status: ch.status,
          imageData: ch.imageData,
          nickname: m.nickname,
        };
      });

      const restUsed = me
        ? await store.countRestPassesUsedInRange({
            roomId: room.id,
            userId: user.id,
            startDate: monday,
            endDate: sunday,
          })
        : 0;

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
    })
  );

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

  const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];
  const activeDateSet = new Set(userActiveDates);
  const weekRhythm: WeekRhythmDay[] = dayLabels.map((label, idx) => {
    const date = shiftDate(monday, idx);
    return {
      label,
      date,
      done: activeDateSet.has(date),
      isToday: date === today,
    };
  });

  return { myRooms, exploreRooms, weekRhythm };
}

export async function createRoom(
  user: UserProfile,
  input: { title: string; tag: string; category?: string; maxCapacity: RoomCapacity },
  today: string = getTodayKst(),
  storeOverride?: OngiStore
): Promise<RoomDetailResponse> {
  const store = resolveStore(storeOverride);
  const title = input.title.trim();
  const tag = normalizeTag(input.tag);
  const category = inferCategory(title, tag, input.category);
  const maxCapacity: RoomCapacity =
    input.maxCapacity === 2 || input.maxCapacity === 6 ? input.maxCapacity : 4;

  const roomId = `room-${crypto.randomUUID().slice(0, 8)}`;
  const memberId = `mem-${crypto.randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();

  await store.createRoomWithHost({
    room: {
      id: roomId,
      title,
      tag,
      category,
      maxCapacity,
      streakDays: 0,
      lastCompletedDate: null,
      createdAt,
    },
    hostMember: {
      id: memberId,
      roomId,
      userId: user.id,
      nickname: user.nickname,
      avatarInitial: user.avatarInitial,
      isHost: true,
      memberStreakDays: 0,
      lastActiveDate: today,
      joinedAt: today,
    },
    createdBy: user.id,
  });

  return (await getRoomDetail(user, roomId, today, today, store))!;
}

export async function getRoomDetail(
  user: UserProfile,
  roomId: string,
  selectedDate?: string,
  today: string = getTodayKst(),
  storeOverride?: OngiStore
): Promise<RoomDetailResponse | null> {
  const store = resolveStore(storeOverride);
  const room = await store.getRoomById(roomId);
  if (!room) return null;

  const rawMembers = await store.listActiveMembers(roomId, user.id);
  const members = await syncRoomEvictions(store, roomId, rawMembers, today);
  const targetDate = selectedDate || today;

  const monday = getMondayOfWeek(today);
  const sunday = shiftDate(monday, 6);

  const [checkins, dateRows, restUsed, todayCheckins] = await Promise.all([
    store.listCheckinsForRoomsDate({
      roomIds: [roomId],
      dateStr: targetDate,
      currentUserId: user.id,
    }),
    store.listCheckinDatesForRoom(roomId),
    store.countRestPassesUsedInRange({
      roomId,
      userId: user.id,
      startDate: monday,
      endDate: sunday,
    }),
    targetDate === today
      ? Promise.resolve(null)
      : store.listCheckinsForRoomsDate({
          roomIds: [roomId],
          dateStr: today,
          currentUserId: user.id,
        }),
  ]);

  const availableDates = [...new Set([today, ...dateRows])].sort((a, b) =>
    b.localeCompare(a)
  );

  const activeUserIds = new Set(members.map(m => m.userId));
  const formerCheckinsCount =
    targetDate === today
      ? 0
      : checkins.filter(c => !activeUserIds.has(c.userId)).length;
  const totalSlots = members.length + formerCheckinsCount;

  const completion = computeCompletionStats(totalSlots, checkins.length);

  const effectiveTodayCheckins = todayCheckins ?? checkins;
  const todayComplete = computeCompletionStats(
    members.length,
    effectiveTodayCheckins.filter(c => activeUserIds.has(c.userId)).length
  ).isComplete;

  const effectiveStreak = computeNextRoomStreak({
    currentStreak: room.streakDays,
    lastCompletedDate: room.lastCompletedDate,
    today,
    isRoomCompleteToday: todayComplete,
  });

  const roomWithLiveStreak: Room = {
    ...room,
    streakDays: effectiveStreak.streakDays,
  };

  const isJoined = members.some(m => m.isCurrentUser);
  const myCheckinOnDate = checkins.find(c => c.userId === user.id);

  const sameTagInspiration =
    members.length <= 1
      ? await store.listSameTagSnippets({
          excludeRoomId: room.id,
          tag: room.tag,
          category: room.category,
          today,
        })
      : [];

  return {
    room: roomWithLiveStreak,
    members,
    checkins,
    selectedDate: targetDate,
    today,
    availableDates,
    layoutMode: resolveBoardLayout(totalSlots),
    completion,
    isJoined,
    restPassesLeftThisWeek: Math.max(0, 1 - restUsed),
    myStatusOnSelectedDate: myCheckinOnDate ? myCheckinOnDate.status : 'pending',
    sameTagInspiration,
  };
}

export async function joinRoom(
  user: UserProfile,
  roomId: string,
  today: string = getTodayKst(),
  storeOverride?: OngiStore
): Promise<
  | { ok: true; room: RoomDetailResponse }
  | { ok: false; status: 404 | 409; error: string }
> {
  const store = resolveStore(storeOverride);
  const room = await store.getRoomById(roomId);
  if (!room) {
    return { ok: false, status: 404, error: '방을 찾을 수 없어요.' };
  }

  const rawMembers = await store.listActiveMembers(roomId, user.id);
  await syncRoomEvictions(store, roomId, rawMembers, today);

  const memberId = `mem-${crypto.randomUUID().slice(0, 8)}`;
  const joinRes = await store.joinRoomAtomic({
    roomId,
    memberId,
    user,
    today,
  });

  if (!joinRes.ok) {
    return joinRes;
  }

  const detail = await getRoomDetail(user, roomId, today, today, store);
  return { ok: true, room: detail! };
}

async function updateStreaksAfterCheckin(
  store: OngiStore,
  room: Room,
  member: RoomMember,
  today: string
): Promise<void> {
  const nextMemberStreak = computeNextMemberStreak({
    currentStreak: member.memberStreakDays,
    lastActiveDate: member.lastActiveDate,
    today,
  });

  const [members, todayCheckins] = await Promise.all([
    store.listActiveMembers(room.id, member.userId),
    store.listCheckinsForRoomsDate({
      roomIds: [room.id],
      dateStr: today,
      currentUserId: member.userId,
    }),
  ]);

  const activeUserIds = new Set(members.map(m => m.userId));
  const activeCheckinCount = todayCheckins.filter(c =>
    activeUserIds.has(c.userId)
  ).length;
  const stats = computeCompletionStats(members.length, activeCheckinCount);

  let roomStreakDays = room.streakDays;
  let lastCompletedDate: string | null = null;

  if (stats.isComplete) {
    const nextRoomStreak = computeNextRoomStreak({
      currentStreak: room.streakDays,
      lastCompletedDate: room.lastCompletedDate,
      today,
      isRoomCompleteToday: true,
    });
    roomStreakDays = nextRoomStreak.streakDays;
    lastCompletedDate = nextRoomStreak.lastCompletedDate;
  }

  await store.applyCheckinStreak({
    roomId: room.id,
    memberId: member.id,
    memberStreakDays: nextMemberStreak,
    today,
    roomStreakDays,
    lastCompletedDate,
  });
}

export async function submitPhotoCheckin(
  user: UserProfile,
  roomId: string,
  input: { imageData: string; note?: string; timestampLabel?: string },
  today: string = getTodayKst(),
  storeOverride?: OngiStore
): Promise<
  | { ok: true; checkin: DailyCheckin; room: RoomDetailResponse }
  | { ok: false; status: 400 | 404 | 409; error: string }
> {
  const store = resolveStore(storeOverride);
  const room = await store.getRoomById(roomId);
  if (!room) {
    return { ok: false, status: 404, error: '방을 찾을 수 없어요.' };
  }

  const parsedImage = parseCheckinImageData(input.imageData || '');
  if (!parsedImage) {
    return {
      ok: false,
      status: 400,
      error: '실시간 촬영된 유효한 이미지(3MB 이하)가 필요해요.',
    };
  }

  const rawMembers = await store.listActiveMembers(roomId, user.id);
  const members = await syncRoomEvictions(store, roomId, rawMembers, today);
  const me = members.find(m => m.isCurrentUser);
  if (!me) {
    return { ok: false, status: 400, error: '먼저 방에 참여한 뒤 인증해 주세요.' };
  }

  const alreadyCheckedIn = await store.hasUserCheckinOnDate({
    roomId,
    userId: user.id,
    dateStr: today,
  });
  if (alreadyCheckedIn) {
    return { ok: false, status: 409, error: '오늘은 이미 이 방에 인증을 남겼어요.' };
  }

  const checkinId = `chk-${crypto.randomUUID().slice(0, 8)}`;
  const note =
    (input.note || '').trim().slice(0, 80) || '오늘도 작은 한 걸음 완료!';
  const timestampLabel =
    (input.timestampLabel || '').trim() || formatCurrentTimeLabel();
  const createdAt = new Date().toISOString();

  const imagePath = await store.uploadCheckinImage({
    userId: user.id,
    roomId,
    checkinId,
    bytes: parsedImage.bytes,
    contentType: parsedImage.contentType,
    ext: parsedImage.ext,
  });

  const insertRes = await store.insertCheckin({
    id: checkinId,
    roomId,
    memberId: me.id,
    userId: user.id,
    authorNickname: me.nickname,
    authorAvatarInitial: me.avatarInitial,
    checkinDate: today,
    status: 'photo',
    imageData: imagePath,
    note,
    timestampLabel,
    createdAt,
  });

  if (!insertRes.ok) {
    return insertRes;
  }

  await updateStreaksAfterCheckin(store, room, me, today);

  const roomDetail = (await getRoomDetail(user, roomId, today, today, store))!;
  const checkin = roomDetail.checkins.find(c => c.id === checkinId)!;
  return { ok: true, checkin, room: roomDetail };
}

export async function submitRestPass(
  user: UserProfile,
  roomId: string,
  today: string = getTodayKst(),
  storeOverride?: OngiStore
): Promise<
  | { ok: true; checkin: DailyCheckin; room: RoomDetailResponse }
  | { ok: false; status: 400 | 404 | 409; error: string }
> {
  const store = resolveStore(storeOverride);
  const room = await store.getRoomById(roomId);
  if (!room) {
    return { ok: false, status: 404, error: '방을 찾을 수 없어요.' };
  }

  const rawMembers = await store.listActiveMembers(roomId, user.id);
  const members = await syncRoomEvictions(store, roomId, rawMembers, today);
  const me = members.find(m => m.isCurrentUser);
  if (!me) {
    return {
      ok: false,
      status: 400,
      error: '먼저 방에 참여한 뒤 휴식권을 사용해 주세요.',
    };
  }

  const alreadyCheckedIn = await store.hasUserCheckinOnDate({
    roomId,
    userId: user.id,
    dateStr: today,
  });
  if (alreadyCheckedIn) {
    return { ok: false, status: 409, error: '오늘은 이미 이 방에 기록을 남겼어요.' };
  }

  const monday = getMondayOfWeek(today);
  const sunday = shiftDate(monday, 6);
  const restUsed = await store.countRestPassesUsedInRange({
    roomId,
    userId: user.id,
    startDate: monday,
    endDate: sunday,
  });
  if (restUsed >= 1) {
    return {
      ok: false,
      status: 400,
      error: '이번 주 휴식권(주 1회)을 이미 모두 사용했어요.',
    };
  }

  const checkinId = `chk-${crypto.randomUUID().slice(0, 8)}`;
  const timestampLabel = formatCurrentTimeLabel();
  const createdAt = new Date().toISOString();

  const insertRes = await store.insertCheckin({
    id: checkinId,
    roomId,
    memberId: me.id,
    userId: user.id,
    authorNickname: me.nickname,
    authorAvatarInitial: me.avatarInitial,
    checkinDate: today,
    status: 'rest',
    imageData: null,
    note: '오늘은 잠시 쉬어가도 괜찮아요',
    timestampLabel,
    createdAt,
  });

  if (!insertRes.ok) {
    return insertRes;
  }

  await updateStreaksAfterCheckin(store, room, me, today);

  const roomDetail = (await getRoomDetail(user, roomId, today, today, store))!;
  const checkin = roomDetail.checkins.find(c => c.id === checkinId)!;
  return { ok: true, checkin, room: roomDetail };
}

export async function toggleCheckinLike(
  user: UserProfile,
  checkinId: string,
  storeOverride?: OngiStore
): Promise<
  { ok: true; checkin: DailyCheckin } | { ok: false; status: 404; error: string }
> {
  const store = resolveStore(storeOverride);
  return store.toggleLike({ checkinId, userId: user.id });
}

export async function getAlbumEntries(
  user: UserProfile,
  params?: { month?: string; roomId?: string; today?: string },
  storeOverride?: OngiStore
): Promise<AlbumResponse> {
  const store = resolveStore(storeOverride);
  const today = params?.today || getTodayKst();
  const month = params?.month || today.slice(0, 7);
  const roomId = params?.roomId?.trim() || undefined;

  const data = await store.listUserAlbumData({
    userId: user.id,
    month,
    roomId,
  });

  const availableMonths = [
    ...new Set([today.slice(0, 7), ...data.availableMonths]),
  ].sort((a, b) => b.localeCompare(a));

  return {
    month,
    availableMonths,
    rooms: data.rooms,
    entries: data.entries,
  };
}

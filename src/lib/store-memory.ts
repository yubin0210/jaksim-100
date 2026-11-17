import type { OngiStore } from '@/lib/repository';
import type {
  AlbumEntry,
  CheckinStatus,
  DailyCheckin,
  InspirationSnippet,
  Room,
  RoomMember,
  UserProfile,
} from '@/types/ongi';

interface MemMember {
  id: string;
  roomId: string;
  userId: string;
  nickname: string;
  avatarInitial: string;
  isHost: boolean;
  memberStreakDays: number;
  lastActiveDate: string;
  joinedAt: string;
  isActive: boolean;
}

interface MemCheckin {
  id: string;
  roomId: string;
  memberId: string | null;
  userId: string;
  authorNickname: string;
  authorAvatarInitial: string;
  checkinDate: string;
  status: CheckinStatus;
  imageData: string | null;
  note: string;
  timestampLabel: string;
  createdAt: string;
}

export function createInMemoryOngiStore(): OngiStore {
  const rooms = new Map<string, Room>();
  const members = new Map<string, MemMember>();
  const checkins = new Map<string, MemCheckin>();
  const likes = new Map<string, Set<string>>();

  const mapMember = (m: MemMember, currentUserId: string): RoomMember => ({
    id: m.id,
    roomId: m.roomId,
    userId: m.userId,
    nickname: m.nickname,
    avatarInitial: m.avatarInitial,
    isCurrentUser: m.userId === currentUserId,
    isHost: m.isHost,
    memberStreakDays: m.memberStreakDays,
    lastActiveDate: m.lastActiveDate,
    joinedAt: m.joinedAt,
  });

  const mapCheckin = (c: MemCheckin, currentUserId: string): DailyCheckin => {
    const likeSet = likes.get(c.id);
    return {
      id: c.id,
      roomId: c.roomId,
      memberId: c.memberId,
      userId: c.userId,
      memberNickname: c.authorNickname,
      memberAvatarInitial: c.authorAvatarInitial,
      isCurrentUser: c.userId === currentUserId,
      checkinDate: c.checkinDate,
      status: c.status,
      imageData: c.imageData,
      note: c.note,
      timestampLabel: c.timestampLabel,
      likesCount: likeSet ? likeSet.size : 0,
      likedByMe: likeSet ? likeSet.has(currentUserId) : false,
      createdAt: c.createdAt,
    };
  };

  return {
    async listAllRooms() {
      return [...rooms.values()].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
    },

    async getRoomById(roomId) {
      const room = rooms.get(roomId);
      return room ? { ...room } : null;
    },

    async createRoomWithHost({ room, hostMember }) {
      rooms.set(room.id, { ...room });
      members.set(hostMember.id, {
        ...hostMember,
        isActive: true,
      });
    },

    async listActiveMembers(roomId, currentUserId) {
      return [...members.values()]
        .filter(m => m.isActive && (!roomId || m.roomId === roomId))
        .map(m => mapMember(m, currentUserId))
        .sort(
          (a, b) =>
            Number(a.isCurrentUser) - Number(b.isCurrentUser) ||
            a.joinedAt.localeCompare(b.joinedAt)
        );
    },

    async applyEviction({ roomId, evictedIds, newHostMemberId }) {
      const evictSet = new Set(evictedIds);
      for (const m of members.values()) {
        if (m.roomId === roomId && m.isActive && evictSet.has(m.id)) {
          m.isActive = false;
          m.isHost = false;
        }
      }
      for (const c of checkins.values()) {
        if (c.roomId === roomId && c.memberId && evictSet.has(c.memberId)) {
          c.memberId = null;
        }
      }
      if (newHostMemberId) {
        const nextHost = members.get(newHostMemberId);
        if (nextHost && nextHost.roomId === roomId && nextHost.isActive) {
          nextHost.isHost = true;
        }
      }
    },

    async joinRoomAtomic({ roomId, memberId, user, today }) {
      const room = rooms.get(roomId);
      if (!room) {
        return { ok: false, status: 404, error: '방을 찾을 수 없어요.' };
      }

      const activeInRoom = [...members.values()].filter(
        m => m.roomId === roomId && m.isActive
      );
      if (activeInRoom.some(m => m.userId === user.id)) {
        return { ok: false, status: 409, error: '이미 참여 중인 방이에요.' };
      }
      if (activeInRoom.length >= room.maxCapacity) {
        return { ok: false, status: 409, error: '방 정원이 모두 찼어요.' };
      }

      const existingInactive = [...members.values()].find(
        m => m.roomId === roomId && m.userId === user.id && !m.isActive
      );
      if (existingInactive) {
        existingInactive.nickname = user.nickname;
        existingInactive.avatarInitial = user.avatarInitial;
        existingInactive.isHost = activeInRoom.length === 0;
        existingInactive.memberStreakDays = 0;
        existingInactive.lastActiveDate = today;
        existingInactive.joinedAt = today;
        existingInactive.isActive = true;
      } else {
        members.set(memberId, {
          id: memberId,
          roomId,
          userId: user.id,
          nickname: user.nickname,
          avatarInitial: user.avatarInitial,
          isHost: activeInRoom.length === 0,
          memberStreakDays: 0,
          lastActiveDate: today,
          joinedAt: today,
          isActive: true,
        });
      }

      return { ok: true };
    },

    async listCheckinsForRoomsDate({ roomIds, dateStr, currentUserId }) {
      const roomSet = new Set(roomIds);
      return [...checkins.values()]
        .filter(c => roomSet.has(c.roomId) && c.checkinDate === dateStr)
        .map(c => mapCheckin(c, currentUserId))
        .sort(
          (a, b) =>
            Number(a.isCurrentUser) - Number(b.isCurrentUser) ||
            a.createdAt.localeCompare(b.createdAt)
        );
    },

    async listCheckinDatesForRoom(roomId) {
      const dates = new Set<string>();
      for (const c of checkins.values()) {
        if (c.roomId === roomId) dates.add(c.checkinDate);
      }
      return [...dates];
    },

    async countRestPassesUsedInRange({ roomId, userId, startDate, endDate }) {
      let count = 0;
      for (const c of checkins.values()) {
        if (
          c.roomId === roomId &&
          c.userId === userId &&
          c.status === 'rest' &&
          c.checkinDate >= startDate &&
          c.checkinDate <= endDate
        ) {
          count += 1;
        }
      }
      return count;
    },

    async hasUserCheckinOnDate({ roomId, userId, dateStr }) {
      for (const c of checkins.values()) {
        if (
          c.roomId === roomId &&
          c.userId === userId &&
          c.checkinDate === dateStr
        ) {
          return true;
        }
      }
      return false;
    },

    async listUserActiveDatesInRange({ userId, startDate, endDate }) {
      const dates = new Set<string>();
      for (const c of checkins.values()) {
        if (
          c.userId === userId &&
          c.checkinDate >= startDate &&
          c.checkinDate <= endDate
        ) {
          dates.add(c.checkinDate);
        }
      }
      return [...dates];
    },

    async uploadCheckinImage({ userId, roomId, checkinId, ext }) {
      return `/mock-storage/${userId}/${roomId}/${checkinId}.${ext}`;
    },

    async insertCheckin(params) {
      for (const c of checkins.values()) {
        if (
          c.roomId === params.roomId &&
          c.userId === params.userId &&
          c.checkinDate === params.checkinDate
        ) {
          return {
            ok: false,
            status: 409,
            error: '오늘은 이미 이 방에 기록을 남겼어요.',
          };
        }
      }
      checkins.set(params.id, {
        id: params.id,
        roomId: params.roomId,
        memberId: params.memberId,
        userId: params.userId,
        authorNickname: params.authorNickname,
        authorAvatarInitial: params.authorAvatarInitial,
        checkinDate: params.checkinDate,
        status: params.status,
        imageData: params.imageData,
        note: params.note,
        timestampLabel: params.timestampLabel,
        createdAt: params.createdAt,
      });
      return { ok: true };
    },

    async applyCheckinStreak({
      roomId,
      memberId,
      memberStreakDays,
      today,
      roomStreakDays,
      lastCompletedDate,
    }) {
      const member = members.get(memberId);
      if (member && member.roomId === roomId) {
        member.memberStreakDays = memberStreakDays;
        member.lastActiveDate = today;
      }
      const room = rooms.get(roomId);
      if (room && lastCompletedDate !== null) {
        room.streakDays = roomStreakDays;
        room.lastCompletedDate = lastCompletedDate;
      }
    },

    async toggleLike({ checkinId, userId }) {
      const existing = checkins.get(checkinId);
      if (!existing) {
        return { ok: false, status: 404, error: '인증 기록을 찾을 수 없어요.' };
      }
      let set = likes.get(checkinId);
      if (!set) {
        set = new Set<string>();
        likes.set(checkinId, set);
      }
      if (set.has(userId)) {
        set.delete(userId);
      } else {
        set.add(userId);
      }
      return { ok: true, checkin: mapCheckin(existing, userId) };
    },

    async listUserAlbumData({ userId, month, roomId }) {
      const userCheckins = [...checkins.values()].filter(c => c.userId === userId);
      const months = new Set<string>();
      const roomMap = new Map<string, { id: string; title: string; tag: string }>();

      for (const m of members.values()) {
        if (m.userId === userId && m.isActive) {
          const r = rooms.get(m.roomId);
          if (r) roomMap.set(r.id, { id: r.id, title: r.title, tag: r.tag });
        }
      }

      for (const c of userCheckins) {
        months.add(c.checkinDate.slice(0, 7));
        const r = rooms.get(c.roomId);
        if (r) roomMap.set(r.id, { id: r.id, title: r.title, tag: r.tag });
      }

      const entries: AlbumEntry[] = userCheckins
        .filter(
          c =>
            c.checkinDate.startsWith(month) && (!roomId || c.roomId === roomId)
        )
        .sort(
          (a, b) =>
            b.checkinDate.localeCompare(a.checkinDate) ||
            b.createdAt.localeCompare(a.createdAt)
        )
        .map(c => {
          const r = rooms.get(c.roomId);
          return {
            id: c.id,
            roomId: c.roomId,
            roomTitle: r?.title ?? '참여했던 방',
            tag: r?.tag ?? '#자기계발',
            checkinDate: c.checkinDate,
            status: c.status,
            imageData: c.imageData,
            note: c.note,
            timestampLabel: c.timestampLabel,
            likesCount: likes.get(c.id)?.size ?? 0,
          };
        });

      return {
        availableMonths: [...months],
        rooms: [...roomMap.values()],
        entries,
      };
    },

    async listSameTagSnippets({ excludeRoomId, tag, category, today }) {
      const candidates = [...checkins.values()]
        .filter(
          c =>
            c.roomId !== excludeRoomId &&
            c.status === 'photo' &&
            Boolean(c.imageData)
        )
        .map(c => ({ checkin: c, room: rooms.get(c.roomId) }))
        .filter(
          (item): item is { checkin: MemCheckin; room: Room } =>
            Boolean(item.room)
        );

      candidates.sort((a, b) => {
        const score = (item: { checkin: MemCheckin; room: Room }) =>
          item.room.tag === tag ? 0 : item.room.category === category ? 1 : 2;
        const sa = score(a);
        const sb = score(b);
        if (sa !== sb) return sa - sb;
        const da = a.checkin.checkinDate === today ? 0 : 1;
        const db = b.checkin.checkinDate === today ? 0 : 1;
        if (da !== db) return da - db;
        return b.checkin.createdAt.localeCompare(a.checkin.createdAt);
      });

      return candidates.slice(0, 4).map(
        ({ checkin, room }): InspirationSnippet => ({
          id: checkin.id,
          roomTitle: room.title,
          tag: room.tag,
          nickname: checkin.authorNickname,
          imageData: checkin.imageData!,
          note: checkin.note,
          timestampLabel: checkin.timestampLabel,
        })
      );
    },
  };
}

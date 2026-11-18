import type { OngiStore } from '@/lib/repository';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type {
  AlbumEntry,
  DailyCheckin,
  InspirationSnippet,
  Room,
  RoomCapacity,
  RoomMember,
} from '@/types/ongi';

interface DbRoomRow {
  id: string;
  title: string;
  tag: string;
  category: string;
  max_capacity: number;
  streak_days: number;
  last_completed_date: string | null;
  created_at: string;
}

interface DbMemberRow {
  id: string;
  room_id: string;
  user_id: string;
  nickname: string;
  avatar_initial: string;
  is_host: boolean;
  member_streak_days: number;
  last_active_date: string;
  joined_at: string;
}

interface DbCheckinRow {
  id: string;
  room_id: string;
  member_id: string | null;
  user_id: string;
  author_nickname: string;
  author_avatar_initial: string;
  checkin_date: string;
  status: 'photo' | 'rest';
  image_data: string | null;
  note: string;
  timestamp_label: string;
  likes_count: number;
  created_at: string;
}

function photoUrl(checkinId: string): string {
  return '/api/checkins/' + encodeURIComponent(checkinId) + '/photo';
}

function mapRoom(r: DbRoomRow): Room {
  return {
    id: r.id,
    title: r.title,
    tag: r.tag,
    category: r.category,
    maxCapacity: r.max_capacity as RoomCapacity,
    streakDays: r.streak_days,
    lastCompletedDate: r.last_completed_date,
    createdAt: r.created_at,
  };
}

function mapMember(m: DbMemberRow, currentUserId: string): RoomMember {
  return {
    id: m.id,
    roomId: m.room_id,
    userId: m.user_id,
    nickname: m.nickname,
    avatarInitial: m.avatar_initial,
    isCurrentUser: m.user_id === currentUserId,
    isHost: m.is_host,
    memberStreakDays: m.member_streak_days,
    lastActiveDate: m.last_active_date,
    joinedAt: m.joined_at,
  };
}

function mapCheckin(
  c: DbCheckinRow,
  currentUserId: string,
  likedCheckinIds: Set<string>
): DailyCheckin {
  return {
    id: c.id,
    roomId: c.room_id,
    memberId: c.member_id,
    userId: c.user_id,
    memberNickname: c.author_nickname,
    memberAvatarInitial: c.author_avatar_initial,
    isCurrentUser: c.user_id === currentUserId,
    checkinDate: c.checkin_date,
    status: c.status,
    imageData: c.image_data ? photoUrl(c.id) : null,
    note: c.note,
    timestampLabel: c.timestamp_label,
    likesCount: c.likes_count,
    likedByMe: likedCheckinIds.has(c.id),
    createdAt: c.created_at,
  };
}

export function createSupabaseOngiStore(): OngiStore {
  return {
    async listAllRooms() {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('rooms')
        .select(
          'id, title, tag, category, max_capacity, streak_days, last_completed_date, created_at'
        )
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return ((data ?? []) as DbRoomRow[]).map(mapRoom);
    },

    async getRoomById(roomId) {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('rooms')
        .select(
          'id, title, tag, category, max_capacity, streak_days, last_completed_date, created_at'
        )
        .eq('id', roomId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data ? mapRoom(data as DbRoomRow) : null;
    },

    async createRoomWithHost({ room, hostMember, createdBy }) {
      const supabase = await createServerSupabaseClient();

      const { error: roomError } = await supabase.from('rooms').insert({
        id: room.id,
        title: room.title,
        tag: room.tag,
        category: room.category,
        max_capacity: room.maxCapacity,
        streak_days: room.streakDays,
        last_completed_date: room.lastCompletedDate,
        created_by: createdBy,
        created_at: room.createdAt,
      });
      if (roomError) throw new Error(roomError.message);

      const { error: memberError } = await supabase.from('room_members').insert({
        id: hostMember.id,
        room_id: hostMember.roomId,
        user_id: hostMember.userId,
        nickname: hostMember.nickname,
        avatar_initial: hostMember.avatarInitial,
        is_host: hostMember.isHost,
        member_streak_days: hostMember.memberStreakDays,
        last_active_date: hostMember.lastActiveDate,
        joined_at: hostMember.joinedAt,
        is_active: true,
      });
      if (memberError) throw new Error(memberError.message);
    },

    async listActiveMembers(roomId, currentUserId) {
      const supabase = await createServerSupabaseClient();
      let query = supabase
        .from('room_members')
        .select(
          'id, room_id, user_id, nickname, avatar_initial, is_host, member_streak_days, last_active_date, joined_at'
        )
        .eq('is_active', true);

      if (roomId) {
        query = query.eq('room_id', roomId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return ((data ?? []) as DbMemberRow[])
        .map(m => mapMember(m, currentUserId))
        .sort(
          (a, b) =>
            Number(a.isCurrentUser) - Number(b.isCurrentUser) ||
            a.joinedAt.localeCompare(b.joinedAt)
        );
    },

    async applyEviction({ roomId, evictedIds, newHostMemberId }) {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.rpc('apply_room_eviction', {
        p_room_id: roomId,
        p_evicted_ids: evictedIds,
        p_new_host_id: newHostMemberId,
      });
      if (error) throw new Error(error.message);
    },

    async joinRoomAtomic({ roomId, memberId, today }) {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.rpc('join_room_atomic', {
        p_room_id: roomId,
        p_member_id: memberId,
        p_today: today,
      });
      if (error) throw new Error(error.message);

      const res = data as { ok: boolean; status?: 404 | 409; error?: string };
      if (!res?.ok) {
        return {
          ok: false,
          status: res?.status === 404 ? 404 : 409,
          error: res?.error || '방 참여에 실패했어요.',
        };
      }
      return { ok: true };
    },

    async listCheckinsForRoomsDate({ roomIds, dateStr, currentUserId }) {
      if (roomIds.length === 0) return [];
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('daily_checkins')
        .select(
          'id, room_id, member_id, user_id, author_nickname, author_avatar_initial, checkin_date, status, image_data, note, timestamp_label, likes_count, created_at'
        )
        .in('room_id', roomIds)
        .eq('checkin_date', dateStr)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      const rows = (data ?? []) as DbCheckinRow[];
      if (rows.length === 0) return [];

      const { data: likeRows, error: likeError } = await supabase
        .from('checkin_likes')
        .select('checkin_id')
        .eq('user_id', currentUserId)
        .in(
          'checkin_id',
          rows.map(r => r.id)
        );
      if (likeError) throw new Error(likeError.message);

      const likedSet = new Set(
        ((likeRows ?? []) as { checkin_id: string }[]).map(l => l.checkin_id)
      );

      return rows
        .map(r => mapCheckin(r, currentUserId, likedSet))
        .sort(
          (a, b) =>
            Number(a.isCurrentUser) - Number(b.isCurrentUser) ||
            a.createdAt.localeCompare(b.createdAt)
        );
    },

    async listCheckinDatesForRoom(roomId) {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('checkin_date')
        .eq('room_id', roomId);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { checkin_date: string }[];
      return [...new Set(rows.map(r => r.checkin_date))];
    },

    async countRestPassesUsedInRange({ roomId, userId, startDate, endDate }) {
      const supabase = await createServerSupabaseClient();
      const { count, error } = await supabase
        .from('daily_checkins')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .eq('status', 'rest')
        .gte('checkin_date', startDate)
        .lte('checkin_date', endDate);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    async hasUserCheckinOnDate({ roomId, userId, dateStr }) {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .eq('checkin_date', dateStr)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data);
    },

    async listUserActiveDatesInRange({ userId, startDate, endDate }) {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('checkin_date')
        .eq('user_id', userId)
        .gte('checkin_date', startDate)
        .lte('checkin_date', endDate);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { checkin_date: string }[];
      return [...new Set(rows.map(r => r.checkin_date))];
    },

    async uploadCheckinImage({ userId, roomId, checkinId, bytes, contentType, ext }) {
      const supabase = await createServerSupabaseClient();
      const objectPath = `${userId}/${roomId}/${checkinId}.${ext}`;
      const { error } = await supabase.storage
        .from('checkins')
        .upload(objectPath, bytes, {
          contentType,
          upsert: false,
        });
      if (error) throw new Error(error.message);

      return objectPath;
    },

    async insertCheckin(params) {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.from('daily_checkins').insert({
        id: params.id,
        room_id: params.roomId,
        member_id: params.memberId,
        user_id: params.userId,
        author_nickname: params.authorNickname,
        author_avatar_initial: params.authorAvatarInitial,
        checkin_date: params.checkinDate,
        status: params.status,
        image_data: params.imageData,
        note: params.note,
        timestamp_label: params.timestampLabel,
        likes_count: 0,
        created_at: params.createdAt,
      });

      if (error) {
        if (error.code === '23505') {
          return {
            ok: false,
            status: 409,
            error: '오늘은 이미 이 방에 기록을 남겼어요.',
          };
        }
        throw new Error(error.message);
      }

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
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.rpc('apply_checkin_streak', {
        p_room_id: roomId,
        p_member_id: memberId,
        p_member_streak: memberStreakDays,
        p_today: today,
        p_room_streak: roomStreakDays,
        p_last_completed_date: lastCompletedDate,
      });
      if (error) throw new Error(error.message);
    },

    async toggleLike({ checkinId, userId }) {
      const supabase = await createServerSupabaseClient();
      const { data: existingRow, error: fetchError } = await supabase
        .from('daily_checkins')
        .select('id, checkin_likes(user_id)')
        .eq('id', checkinId)
        .eq('checkin_likes.user_id', userId)
        .maybeSingle();

      if (fetchError) throw new Error(fetchError.message);
      if (!existingRow) {
        return { ok: false, status: 404, error: '인증 기록을 찾을 수 없어요.' };
      }

      const willLike = existingRow.checkin_likes.length === 0;
      if (!willLike) {
        const { error: delError } = await supabase
          .from('checkin_likes')
          .delete()
          .eq('checkin_id', checkinId)
          .eq('user_id', userId);
        if (delError) throw new Error(delError.message);
      } else {
        const { error: insError } = await supabase
          .from('checkin_likes')
          .insert({ checkin_id: checkinId, user_id: userId });
        if (insError) throw new Error(insError.message);
      }

      const { data: updatedRow, error: reloadError } = await supabase
        .from('daily_checkins')
        .select(
          'id, room_id, member_id, user_id, author_nickname, author_avatar_initial, checkin_date, status, image_data, note, timestamp_label, likes_count, created_at'
        )
        .eq('id', checkinId)
        .single();

      if (reloadError) throw new Error(reloadError.message);

      const likedSet = new Set<string>(willLike ? [checkinId] : []);
      return {
        ok: true,
        checkin: mapCheckin(updatedRow as DbCheckinRow, userId, likedSet),
      };
    },

    async listUserAlbumData({ userId, month, roomId }) {
      const supabase = await createServerSupabaseClient();

      const [{ data: allUserCheckins, error: chkError }, { data: activeRooms, error: memError }] =
        await Promise.all([
          supabase
            .from('daily_checkins')
            .select(
              'id, room_id, checkin_date, status, image_data, note, timestamp_label, likes_count, created_at, rooms!inner(id, title, tag)'
            )
            .eq('user_id', userId)
            .order('checkin_date', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase
            .from('room_members')
            .select('rooms!inner(id, title, tag)')
            .eq('user_id', userId)
            .eq('is_active', true),
        ]);

      if (chkError) throw new Error(chkError.message);
      if (memError) throw new Error(memError.message);

      type AlbumJoinRow = {
        id: string;
        room_id: string;
        checkin_date: string;
        status: 'photo' | 'rest';
        image_data: string | null;
        note: string;
        timestamp_label: string;
        likes_count: number;
        created_at: string;
        rooms: { id: string; title: string; tag: string };
      };

      const rows = (allUserCheckins ?? []) as unknown as AlbumJoinRow[];
      const months = new Set<string>();
      const roomMap = new Map<string, { id: string; title: string; tag: string }>();

      for (const m of (activeRooms ?? []) as unknown as {
        rooms: { id: string; title: string; tag: string };
      }[]) {
        roomMap.set(m.rooms.id, {
          id: m.rooms.id,
          title: m.rooms.title,
          tag: m.rooms.tag,
        });
      }

      for (const r of rows) {
        months.add(r.checkin_date.slice(0, 7));
        roomMap.set(r.rooms.id, {
          id: r.rooms.id,
          title: r.rooms.title,
          tag: r.rooms.tag,
        });
      }

      const entries: AlbumEntry[] = rows
        .filter(
          r => r.checkin_date.startsWith(month) && (!roomId || r.room_id === roomId)
        )
        .map(r => ({
          id: r.id,
          roomId: r.room_id,
          roomTitle: r.rooms.title,
          tag: r.rooms.tag,
          checkinDate: r.checkin_date,
          status: r.status,
          imageData: r.image_data ? photoUrl(r.id) : null,
          note: r.note,
          timestampLabel: r.timestamp_label,
          likesCount: r.likes_count,
        }));

      return {
        availableMonths: [...months],
        rooms: [...roomMap.values()],
        entries,
      };
    },

    async listSameTagSnippets({ excludeRoomId, tag, category, today }) {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('daily_checkins')
        .select(
          'id, room_id, author_nickname, image_data, note, timestamp_label, checkin_date, created_at, rooms!inner(title, tag, category)'
        )
        .neq('room_id', excludeRoomId)
        .eq('status', 'photo')
        .not('image_data', 'is', null)
        .order('created_at', { ascending: false })
        .limit(24);

      if (error) throw new Error(error.message);

      type SnippetRow = {
        id: string;
        room_id: string;
        author_nickname: string;
        image_data: string;
        note: string;
        timestamp_label: string;
        checkin_date: string;
        created_at: string;
        rooms: { title: string; tag: string; category: string };
      };

      const rows = (data ?? []) as unknown as SnippetRow[];
      rows.sort((a, b) => {
        const score = (row: SnippetRow) =>
          row.rooms.tag === tag ? 0 : row.rooms.category === category ? 1 : 2;
        const sa = score(a);
        const sb = score(b);
        if (sa !== sb) return sa - sb;
        const da = a.checkin_date === today ? 0 : 1;
        const db = b.checkin_date === today ? 0 : 1;
        if (da !== db) return da - db;
        return b.created_at.localeCompare(a.created_at);
      });

      return rows.slice(0, 4).map(
        (r): InspirationSnippet => ({
          id: r.id,
          roomTitle: r.rooms.title,
          tag: r.rooms.tag,
          nickname: r.author_nickname,
          imageData: photoUrl(r.id),
          note: r.note,
          timestampLabel: r.timestamp_label,
        })
      );
    },
  };
}

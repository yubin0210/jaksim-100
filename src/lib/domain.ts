import type {
  CompletionStats,
  LayoutMode,
  RoomMember,
} from '@/types/ongi';

export function getTodayKst(now: Date = new Date()): string {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

export function shiftDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export function getMondayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  return shiftDate(dateStr, diff);
}

export function resolveBoardLayout(memberCount: number): LayoutMode {
  if (memberCount <= 1) return 'single';
  if (memberCount === 2) return 'split-2';
  if (memberCount === 3) return 'split-3';
  if (memberCount === 4) return 'grid-2x2';
  return 'grid-2x3';
}

export function computeCompletionStats(
  memberCount: number,
  completedCount: number
): CompletionStats {
  if (memberCount <= 0) {
    return { completedCount: 0, totalCount: 0, percent: 0, isComplete: false };
  }
  const safeDone = Math.max(0, Math.min(completedCount, memberCount));
  const percent = Math.round((safeDone / memberCount) * 100);
  return {
    completedCount: safeDone,
    totalCount: memberCount,
    percent,
    isComplete: safeDone >= memberCount,
  };
}

export function computeNextRoomStreak(params: {
  currentStreak: number;
  lastCompletedDate: string | null;
  today: string;
  isRoomCompleteToday: boolean;
}): { streakDays: number; lastCompletedDate: string | null } {
  const { currentStreak, lastCompletedDate, today, isRoomCompleteToday } = params;
  const yesterday = shiftDate(today, -1);

  if (!isRoomCompleteToday) {
    if (
      lastCompletedDate === null ||
      lastCompletedDate === today ||
      lastCompletedDate === yesterday
    ) {
      return { streakDays: currentStreak, lastCompletedDate };
    }
    return { streakDays: 0, lastCompletedDate };
  }

  if (lastCompletedDate === today) {
    return { streakDays: currentStreak, lastCompletedDate: today };
  }

  if (lastCompletedDate === yesterday) {
    return { streakDays: currentStreak + 1, lastCompletedDate: today };
  }

  return { streakDays: 1, lastCompletedDate: today };
}

export function computeNextMemberStreak(params: {
  currentStreak: number;
  lastActiveDate: string | null;
  today: string;
}): number {
  const { currentStreak, lastActiveDate, today } = params;
  if (lastActiveDate === today) return currentStreak;
  if (lastActiveDate === shiftDate(today, -1)) return currentStreak + 1;
  return 1;
}

export function evaluateInactiveEvictions(params: {
  members: RoomMember[];
  today: string;
  protectCurrentUser?: boolean;
}): { kept: RoomMember[]; evictedIds: string[]; newHostMemberId: string | null } {
  const { members, today, protectCurrentUser = true } = params;
  if (members.length <= 1) {
    return { kept: members.map(m => ({ ...m })), evictedIds: [], newHostMemberId: null };
  }

  const cutoff = shiftDate(today, -3);
  const candidates = new Set<string>();

  for (const m of members) {
    if (protectCurrentUser && m.isCurrentUser) continue;
    if (m.joinedAt <= cutoff && m.lastActiveDate < cutoff) {
      candidates.add(m.id);
    }
  }

  // Never evict down to 0 members: protect the earliest-joined member if all are inactive
  if (candidates.size >= members.length) {
    const sortedByJoin = [...members].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
    candidates.delete(sortedByJoin[0].id);
  }

  const evictedIds = members.filter(m => candidates.has(m.id)).map(m => m.id);
  const kept = members.filter(m => !candidates.has(m.id)).map(m => ({ ...m }));

  let newHostMemberId: string | null = null;
  const hasHostRemaining = kept.some(m => m.isHost);
  if (!hasHostRemaining && kept.length > 0) {
    const earliest = [...kept].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
    earliest.isHost = true;
    newHostMemberId = earliest.id;
  }

  return { kept, evictedIds, newHostMemberId };
}

export function sortExploreRooms<
  T extends { memberCount: number; maxCapacity: number; streakDays: number }
>(rooms: T[]): T[] {
  const rank = (r: T) => {
    const open = r.maxCapacity - r.memberCount;
    if (open === 1) return 0;
    if (open > 1) return 1;
    return 2;
  };
  return [...rooms].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (b.streakDays !== a.streakDays) return b.streakDays - a.streakDays;
    return b.memberCount - a.memberCount;
  });
}

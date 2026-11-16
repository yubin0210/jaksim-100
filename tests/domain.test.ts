import { describe, expect, it } from 'vitest';
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
import type { RoomMember } from '@/types/ongi';

function makeMember(overrides: Partial<RoomMember> = {}): RoomMember {
  return {
    id: 'm1',
    roomId: 'r1',
    userId: 'u1',
    nickname: '멤버',
    avatarInitial: '멤',
    isCurrentUser: false,
    isHost: false,
    memberStreakDays: 3,
    lastActiveDate: '2026-11-15',
    joinedAt: '2026-11-01',
    ...overrides,
  };
}

describe('date helpers', () => {
  it('computes KST date string across UTC midnight boundary', () => {
    const utcLateEvening = new Date('2026-11-16T16:00:00Z'); // 2026-11-17 01:00 KST
    expect(getTodayKst(utcLateEvening)).toBe('2026-11-17');
  });

  it('shifts YYYY-MM-DD dates accurately and finds Monday of the week', () => {
    expect(shiftDate('2026-11-16', -3)).toBe('2026-11-13');
    expect(shiftDate('2026-11-01', -1)).toBe('2026-10-31');
    // 2026-11-16 is Monday; 2026-11-22 is Sunday -> same Monday
    expect(getMondayOfWeek('2026-11-16')).toBe('2026-11-16');
    expect(getMondayOfWeek('2026-11-19')).toBe('2026-11-16');
    expect(getMondayOfWeek('2026-11-22')).toBe('2026-11-16');
  });
});

describe('resolveBoardLayout', () => {
  it('adapts layout cleanly to active member count from 1 to 6', () => {
    expect(resolveBoardLayout(1)).toBe('single');
    expect(resolveBoardLayout(2)).toBe('split-2');
    expect(resolveBoardLayout(3)).toBe('split-3');
    expect(resolveBoardLayout(4)).toBe('grid-2x2');
    expect(resolveBoardLayout(5)).toBe('grid-2x3');
    expect(resolveBoardLayout(6)).toBe('grid-2x3');
  });
});

describe('computeCompletionStats', () => {
  it('computes rounded percentages and completion state', () => {
    expect(computeCompletionStats(4, 3)).toEqual({
      completedCount: 3,
      totalCount: 4,
      percent: 75,
      isComplete: false,
    });
    expect(computeCompletionStats(2, 2)).toEqual({
      completedCount: 2,
      totalCount: 2,
      percent: 100,
      isComplete: true,
    });
    expect(computeCompletionStats(3, 1)).toEqual({
      completedCount: 1,
      totalCount: 3,
      percent: 33,
      isComplete: false,
    });
    expect(computeCompletionStats(0, 0)).toEqual({
      completedCount: 0,
      totalCount: 0,
      percent: 0,
      isComplete: false,
    });
  });
});

describe('streak calculation (Review Focus #1)', () => {
  it('never increments streakDays more than once on the same day', () => {
    const first = computeNextRoomStreak({
      currentStreak: 12,
      lastCompletedDate: '2026-11-15',
      today: '2026-11-16',
      isRoomCompleteToday: true,
    });
    expect(first).toEqual({ streakDays: 13, lastCompletedDate: '2026-11-16' });

    const duplicateSameDay = computeNextRoomStreak({
      currentStreak: first.streakDays,
      lastCompletedDate: first.lastCompletedDate,
      today: '2026-11-16',
      isRoomCompleteToday: true,
    });
    expect(duplicateSameDay).toEqual({ streakDays: 13, lastCompletedDate: '2026-11-16' });
  });

  it('resets room streak to 1 when yesterday was missed, and 0 before today completes', () => {
    expect(
      computeNextRoomStreak({
        currentStreak: 9,
        lastCompletedDate: '2026-11-14',
        today: '2026-11-16',
        isRoomCompleteToday: false,
      })
    ).toEqual({ streakDays: 0, lastCompletedDate: '2026-11-14' });

    expect(
      computeNextRoomStreak({
        currentStreak: 9,
        lastCompletedDate: '2026-11-14',
        today: '2026-11-16',
        isRoomCompleteToday: true,
      })
    ).toEqual({ streakDays: 1, lastCompletedDate: '2026-11-16' });
  });

  it('updates member streak based on yesterday activity and preserves same-day idempotency', () => {
    expect(
      computeNextMemberStreak({
        currentStreak: 5,
        lastActiveDate: '2026-11-15',
        today: '2026-11-16',
      })
    ).toBe(6);

    expect(
      computeNextMemberStreak({
        currentStreak: 5,
        lastActiveDate: '2026-11-16',
        today: '2026-11-16',
      })
    ).toBe(5);

    expect(
      computeNextMemberStreak({
        currentStreak: 5,
        lastActiveDate: '2026-11-13',
        today: '2026-11-16',
      })
    ).toBe(1);
  });
});

describe('evaluateInactiveEvictions (Review Focus #5)', () => {
  const today = '2026-11-16'; // D-3 = 2026-11-13

  it('evicts members inactive across D-3, D-2, D-1 when joined <= D-3, keeping active or newly joined members', () => {
    const members: RoomMember[] = [
      makeMember({ id: 'm1', isHost: true, lastActiveDate: '2026-11-15', joinedAt: '2026-11-01' }),
      makeMember({ id: 'm2', lastActiveDate: '2026-11-12', joinedAt: '2026-11-01' }), // missed 13, 14, 15 -> evict
      makeMember({ id: 'm3', lastActiveDate: '2026-11-13', joinedAt: '2026-11-01' }), // active on D-3 -> keep
      makeMember({ id: 'm4', lastActiveDate: '2026-11-14', joinedAt: '2026-11-14' }), // joined after D-3 -> keep
    ];

    const res = evaluateInactiveEvictions({ members, today, protectCurrentUser: true });
    expect(res.evictedIds).toEqual(['m2']);
    expect(res.kept.map(m => m.id)).toEqual(['m1', 'm3', 'm4']);
    expect(res.newHostMemberId).toBeNull();
  });

  it('never evicts the last remaining member of a room even if inactive > 3 days', () => {
    const members: RoomMember[] = [
      makeMember({ id: 'solo', isHost: true, lastActiveDate: '2026-11-01', joinedAt: '2026-10-20' }),
    ];

    const res = evaluateInactiveEvictions({ members, today, protectCurrentUser: false });
    expect(res.evictedIds).toEqual([]);
    expect(res.kept.map(m => m.id)).toEqual(['solo']);
  });

  it('transfers host to the earliest-joined remaining member when host is evicted', () => {
    const members: RoomMember[] = [
      makeMember({ id: 'old-host', isHost: true, lastActiveDate: '2026-11-10', joinedAt: '2026-11-01' }),
      makeMember({ id: 'later', isHost: false, lastActiveDate: '2026-11-15', joinedAt: '2026-11-10' }),
      makeMember({ id: 'earliest', isHost: false, lastActiveDate: '2026-11-15', joinedAt: '2026-11-05' }),
    ];

    const res = evaluateInactiveEvictions({ members, today, protectCurrentUser: false });
    expect(res.evictedIds).toEqual(['old-host']);
    expect(res.newHostMemberId).toBe('earliest');
    expect(res.kept.find(m => m.id === 'earliest')?.isHost).toBe(true);
    expect(res.kept.find(m => m.id === 'later')?.isHost).toBe(false);
  });

  it('respects protectCurrentUser flag', () => {
    const members: RoomMember[] = [
      makeMember({ id: 'host', isHost: true, lastActiveDate: '2026-11-15', joinedAt: '2026-11-01' }),
      makeMember({ id: 'me', isCurrentUser: true, lastActiveDate: '2026-11-10', joinedAt: '2026-11-01' }),
    ];

    expect(evaluateInactiveEvictions({ members, today, protectCurrentUser: true }).evictedIds).toEqual([]);
    expect(evaluateInactiveEvictions({ members, today, protectCurrentUser: false }).evictedIds).toEqual(['me']);
  });
});

describe('sortExploreRooms', () => {
  it('prioritizes 1-slot-left rooms first, then other under-capacity rooms, then higher streak', () => {
    const sorted = sortExploreRooms([
      { id: '1of4', memberCount: 1, maxCapacity: 4, streakDays: 1 },
      { id: '2of4', memberCount: 2, maxCapacity: 4, streakDays: 6 },
      { id: '3of4', memberCount: 3, maxCapacity: 4, streakDays: 4 },
      { id: '3of4-hot', memberCount: 3, maxCapacity: 4, streakDays: 10 },
    ]);
    expect(sorted.map(r => r.id)).toEqual(['3of4-hot', '3of4', '2of4', '1of4']);
  });
});

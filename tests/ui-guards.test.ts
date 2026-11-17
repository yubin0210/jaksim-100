import { describe, expect, it } from 'vitest';
import {
  buildRoomBoardSlots,
  isCameraShutterAllowed,
  resolveRoomBoardFooterState,
} from '@/lib/ui-guards';
import type { DailyCheckin, RoomMember } from '@/types/ongi';

const memberA: RoomMember = {
  id: 'mem-a',
  roomId: 'room-1',
  userId: 'user-a',
  nickname: '민지',
  avatarInitial: '민',
  isCurrentUser: true,
  isHost: true,
  memberStreakDays: 3,
  lastActiveDate: '2026-11-16',
  joinedAt: '2026-11-10',
};

const formerCheckin: DailyCheckin = {
  id: 'chk-old',
  roomId: 'room-1',
  memberId: null,
  userId: 'user-former',
  memberNickname: '지훈',
  memberAvatarInitial: '지',
  isCurrentUser: false,
  checkinDate: '2026-11-12',
  status: 'photo',
  imageData: 'https://example.com/old.jpg',
  note: '지난주 러닝 완료',
  timestampLabel: '07:10 PM',
  likesCount: 2,
  likedByMe: false,
  createdAt: '2026-11-12T10:10:00Z',
};

describe('resolveRoomBoardFooterState (Review Focus #4)', () => {
  it('distinguishes non-member joinable/full preview states from active member states', () => {
    expect(
      resolveRoomBoardFooterState({
        isJoined: false,
        memberCount: 2,
        maxCapacity: 4,
        myStatusOnSelectedDate: 'pending',
        restPassesLeftThisWeek: 1,
        isToday: true,
      })
    ).toBe('joinable-preview');

    expect(
      resolveRoomBoardFooterState({
        isJoined: false,
        memberCount: 4,
        maxCapacity: 4,
        myStatusOnSelectedDate: 'pending',
        restPassesLeftThisWeek: 1,
        isToday: false,
      })
    ).toBe('full-preview');

    expect(
      resolveRoomBoardFooterState({
        isJoined: true,
        memberCount: 2,
        maxCapacity: 4,
        myStatusOnSelectedDate: 'pending',
        restPassesLeftThisWeek: 1,
        isToday: true,
      })
    ).toBe('member-pending-rest-available');

    expect(
      resolveRoomBoardFooterState({
        isJoined: true,
        memberCount: 2,
        maxCapacity: 4,
        myStatusOnSelectedDate: 'pending',
        restPassesLeftThisWeek: 0,
        isToday: true,
      })
    ).toBe('member-pending-rest-used');

    expect(
      resolveRoomBoardFooterState({
        isJoined: true,
        memberCount: 2,
        maxCapacity: 4,
        myStatusOnSelectedDate: 'photo',
        restPassesLeftThisWeek: 1,
        isToday: false,
      })
    ).toBe('past-readonly');
  });
});

describe('isCameraShutterAllowed (Review Focus #5)', () => {
  it('blocks synthetic fallback capture in production and allows only live camera unless allowFallback=true', () => {
    expect(isCameraShutterAllowed({ cameraMode: 'live', allowFallback: false })).toBe(true);
    expect(isCameraShutterAllowed({ cameraMode: 'loading', allowFallback: true })).toBe(false);
    expect(isCameraShutterAllowed({ cameraMode: 'fallback', allowFallback: false })).toBe(false);
    expect(isCameraShutterAllowed({ cameraMode: 'fallback', allowFallback: true })).toBe(true);
  });
});

describe('buildRoomBoardSlots (post-eviction past-date tile preservation)', () => {
  it('renders former members historical checkins on past dates while preserving active slots', () => {
    const pastSlots = buildRoomBoardSlots({
      members: [memberA],
      checkins: [formerCheckin],
      isToday: false,
    });
    expect(pastSlots).toHaveLength(2);
    expect(pastSlots[1]).toMatchObject({
      key: 'former-user-former',
      nickname: '지훈',
      avatarInitial: '지',
      isCurrentUser: false,
      checkin: formerCheckin,
    });

    const todaySlots = buildRoomBoardSlots({
      members: [memberA],
      checkins: [],
      isToday: true,
    });
    expect(todaySlots).toHaveLength(1);
    expect(todaySlots[0].checkin).toBeUndefined();
  });
});

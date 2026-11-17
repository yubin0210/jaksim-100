import type { DailyCheckin, RoomMember } from '@/types/ongi';

export type RoomBoardFooterState =
  | 'joinable-preview'
  | 'full-preview'
  | 'past-readonly'
  | 'member-photo-done'
  | 'member-rest-done'
  | 'member-pending-rest-available'
  | 'member-pending-rest-used';

export function resolveRoomBoardFooterState(params: {
  isJoined: boolean;
  memberCount: number;
  maxCapacity: number;
  myStatusOnSelectedDate: 'pending' | 'photo' | 'rest';
  restPassesLeftThisWeek: number;
  isToday: boolean;
}): RoomBoardFooterState {
  if (!params.isJoined) {
    return params.memberCount < params.maxCapacity
      ? 'joinable-preview'
      : 'full-preview';
  }
  if (!params.isToday) {
    return 'past-readonly';
  }
  if (params.myStatusOnSelectedDate === 'photo') {
    return 'member-photo-done';
  }
  if (params.myStatusOnSelectedDate === 'rest') {
    return 'member-rest-done';
  }
  return params.restPassesLeftThisWeek > 0
    ? 'member-pending-rest-available'
    : 'member-pending-rest-used';
}

export function isCameraShutterAllowed(params: {
  cameraMode: 'loading' | 'live' | 'fallback';
  allowFallback: boolean;
}): boolean {
  if (params.cameraMode === 'live') return true;
  if (params.cameraMode === 'fallback') return params.allowFallback;
  return false;
}

export interface RoomBoardSlot {
  key: string;
  nickname: string;
  avatarInitial: string;
  isCurrentUser: boolean;
  checkin?: DailyCheckin;
}

export function buildRoomBoardSlots(params: {
  members: RoomMember[];
  checkins: DailyCheckin[];
  isToday: boolean;
}): RoomBoardSlot[] {
  const checkinByUser = new Map<string, DailyCheckin>(
    params.checkins.map(c => [c.userId, c])
  );

  const slots: RoomBoardSlot[] = params.members.map(member => ({
    key: member.id,
    nickname: member.nickname,
    avatarInitial: member.avatarInitial,
    isCurrentUser: member.isCurrentUser,
    checkin: checkinByUser.get(member.userId),
  }));

  if (!params.isToday) {
    const activeUserIds = new Set(params.members.map(m => m.userId));
    for (const c of params.checkins) {
      if (!activeUserIds.has(c.userId)) {
        slots.push({
          key: `former-${c.userId}`,
          nickname: c.memberNickname,
          avatarInitial: c.memberAvatarInitial,
          isCurrentUser: c.isCurrentUser,
          checkin: c,
        });
      }
    }
  }

  return slots;
}

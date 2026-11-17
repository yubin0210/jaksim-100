export type RoomCapacity = 2 | 4 | 6;
export type CheckinStatus = 'photo' | 'rest';
export type LayoutMode = 'single' | 'split-2' | 'split-3' | 'grid-2x2' | 'grid-2x3';

export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  avatarInitial: string;
}

export interface Room {
  id: string;
  title: string;
  tag: string;
  category: string;
  maxCapacity: RoomCapacity;
  streakDays: number;
  lastCompletedDate: string | null;
  createdAt: string;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  nickname: string;
  avatarInitial: string;
  isCurrentUser: boolean;
  isHost: boolean;
  memberStreakDays: number;
  lastActiveDate: string;
  joinedAt: string;
}

export interface DailyCheckin {
  id: string;
  roomId: string;
  memberId: string | null;
  userId: string;
  memberNickname: string;
  memberAvatarInitial: string;
  isCurrentUser: boolean;
  checkinDate: string;
  status: CheckinStatus;
  imageData: string | null;
  note: string;
  timestampLabel: string;
  likesCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export interface PreviewTile {
  status: 'photo' | 'rest' | 'empty';
  imageData: string | null;
  nickname: string;
}

export interface RoomSummary {
  id: string;
  title: string;
  tag: string;
  category: string;
  maxCapacity: RoomCapacity;
  memberCount: number;
  streakDays: number;
  completedCount: number;
  completionPercent: number;
  myStatusToday: 'pending' | 'photo' | 'rest';
  isJoined: boolean;
  restPassesLeftThisWeek: number;
  previewTiles: PreviewTile[];
}

export interface WeekRhythmDay {
  label: string;
  date: string;
  done: boolean;
  isToday: boolean;
}

export interface CompletionStats {
  completedCount: number;
  totalCount: number;
  percent: number;
  isComplete: boolean;
}

export interface InspirationSnippet {
  id: string;
  roomTitle: string;
  tag: string;
  nickname: string;
  imageData: string;
  note: string;
  timestampLabel: string;
}

export interface RoomDetailResponse {
  room: Room;
  members: RoomMember[];
  checkins: DailyCheckin[];
  selectedDate: string;
  today: string;
  availableDates: string[];
  layoutMode: LayoutMode;
  completion: CompletionStats;
  isJoined: boolean;
  restPassesLeftThisWeek: number;
  myStatusOnSelectedDate: 'pending' | 'photo' | 'rest';
  sameTagInspiration: InspirationSnippet[];
}

export interface AlbumEntry {
  id: string;
  roomId: string;
  roomTitle: string;
  tag: string;
  checkinDate: string;
  status: CheckinStatus;
  imageData: string | null;
  note: string;
  timestampLabel: string;
  likesCount: number;
}

export interface AlbumResponse {
  month: string;
  availableMonths: string[];
  rooms: { id: string; title: string; tag: string }[];
  entries: AlbumEntry[];
}

import { shiftDate } from '@/lib/domain';
import type { RoomCapacity } from '@/types/ongi';

export const PHOTOS = {
  gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80',
  weights: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80',
  cardio: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=600&q=80',
  running: 'https://images.unsplash.com/photo-1629671651954-02a29a2b8182?auto=format&fit=crop&w=600&q=80',
  yoga: 'https://images.unsplash.com/photo-1548966268-b978ed7b2e83?auto=format&fit=crop&w=600&q=80',
  bookCoffee: 'https://images.unsplash.com/photo-1724080924532-150245b4a694?auto=format&fit=crop&w=600&q=80',
  notebookCoffee: 'https://images.unsplash.com/photo-1634746027343-985ad425b8b5?auto=format&fit=crop&w=600&q=80',
  bookTable: 'https://images.unsplash.com/photo-1638812990013-afa1eeacff15?auto=format&fit=crop&w=600&q=80',
  laptopDesk: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?auto=format&fit=crop&w=600&q=80',
} as const;

export interface SeedRoom {
  id: string;
  title: string;
  tag: string;
  category: string;
  maxCapacity: RoomCapacity;
  streakDays: number;
  lastCompletedDate: string | null;
  members: {
    id: string;
    userId: string;
    nickname: string;
    avatarInitial: string;
    isCurrentUser: boolean;
    isHost: boolean;
    memberStreakDays: number;
    lastActiveOffset: number;
    joinedOffset: number;
  }[];
  checkins: {
    id: string;
    memberId: string;
    dayOffset: number;
    status: 'photo' | 'rest';
    imageData: string | null;
    note: string;
    timestampLabel: string;
    likesCount: number;
    likedByMe: boolean;
  }[];
}

export function buildSeedRooms(today: string): SeedRoom[] {
  const yesterday = shiftDate(today, -1);

  return [
    // 1. Joined room: 4 members, 3 completed today (75%), user_me pending
    {
      id: 'room-workout',
      title: '저녁 운동 메이트',
      tag: '#오운완',
      category: 'exercise',
      maxCapacity: 4,
      streakDays: 12,
      lastCompletedDate: yesterday,
      members: [
        { id: 'mem-w-1', userId: 'u-jihoon', nickname: '지훈', avatarInitial: '지', isCurrentUser: false, isHost: true, memberStreakDays: 12, lastActiveOffset: 0, joinedOffset: -14 },
        { id: 'mem-w-2', userId: 'u-seoyeon', nickname: '서연', avatarInitial: '서', isCurrentUser: false, isHost: false, memberStreakDays: 12, lastActiveOffset: 0, joinedOffset: -14 },
        { id: 'mem-w-3', userId: 'u-taehyun', nickname: '태현', avatarInitial: '태', isCurrentUser: false, isHost: false, memberStreakDays: 9, lastActiveOffset: 0, joinedOffset: -10 },
        { id: 'mem-w-me', userId: 'user_me', nickname: '나', avatarInitial: '나', isCurrentUser: true, isHost: false, memberStreakDays: 12, lastActiveOffset: -1, joinedOffset: -14 },
      ],
      checkins: [
        // Today (3/4)
        { id: 'chk-w-t1', memberId: 'mem-w-1', dayOffset: 0, status: 'photo', imageData: PHOTOS.gym, note: '하체 루틴 끝! 개운하다', timestampLabel: '07:42 PM', likesCount: 3, likedByMe: false },
        { id: 'chk-w-t2', memberId: 'mem-w-2', dayOffset: 0, status: 'photo', imageData: PHOTOS.running, note: '노을 보며 한강 5km 완주', timestampLabel: '08:15 PM', likesCount: 2, likedByMe: false },
        { id: 'chk-w-t3', memberId: 'mem-w-3', dayOffset: 0, status: 'photo', imageData: PHOTOS.yoga, note: '가볍게 매트 스트레칭 30분', timestampLabel: '09:10 PM', likesCount: 2, likedByMe: false },
        // Yesterday (4/4 completed)
        { id: 'chk-w-y1', memberId: 'mem-w-1', dayOffset: -1, status: 'photo', imageData: PHOTOS.weights, note: '등 운동 데드리프트 4세트', timestampLabel: '08:05 PM', likesCount: 2, likedByMe: true },
        { id: 'chk-w-y2', memberId: 'mem-w-2', dayOffset: -1, status: 'photo', imageData: PHOTOS.cardio, note: '인터벌 러닝 30분 완료', timestampLabel: '08:22 PM', likesCount: 1, likedByMe: false },
        { id: 'chk-w-y3', memberId: 'mem-w-3', dayOffset: -1, status: 'photo', imageData: PHOTOS.yoga, note: '폼롤러로 뭉친 어깨 풀기', timestampLabel: '09:18 PM', likesCount: 1, likedByMe: false },
        { id: 'chk-w-yme', memberId: 'mem-w-me', dayOffset: -1, status: 'photo', imageData: PHOTOS.weights, note: '피곤했지만 덤벨 25분 채움!', timestampLabel: '09:40 PM', likesCount: 3, likedByMe: false },
        // 2 days ago
        { id: 'chk-w-2me', memberId: 'mem-w-me', dayOffset: -2, status: 'photo', imageData: PHOTOS.running, note: '동네 천변 가볍게 3km 조깅', timestampLabel: '07:55 PM', likesCount: 2, likedByMe: false },
      ],
    },

    // 2. Joined room: 2 members, 2 completed today (100%), user_me done
    {
      id: 'room-reading',
      title: '밤 10시 차분한 독서방',
      tag: '#독서모임',
      category: 'reading',
      maxCapacity: 2,
      streakDays: 5,
      lastCompletedDate: today,
      members: [
        { id: 'mem-r-1', userId: 'u-minji', nickname: '민지', avatarInitial: '민', isCurrentUser: false, isHost: true, memberStreakDays: 5, lastActiveOffset: 0, joinedOffset: -7 },
        { id: 'mem-r-me', userId: 'user_me', nickname: '나', avatarInitial: '나', isCurrentUser: true, isHost: false, memberStreakDays: 5, lastActiveOffset: 0, joinedOffset: -7 },
      ],
      checkins: [
        { id: 'chk-r-t1', memberId: 'mem-r-1', dayOffset: 0, status: 'photo', imageData: PHOTOS.bookCoffee, note: '자기 전 25쪽 차분히 읽었어요', timestampLabel: '09:18 PM', likesCount: 2, likedByMe: true },
        { id: 'chk-r-tme', memberId: 'mem-r-me', dayOffset: 0, status: 'photo', imageData: PHOTOS.notebookCoffee, note: '오늘 마음에 남은 문장 필사 완료', timestampLabel: '09:30 PM', likesCount: 1, likedByMe: false },
        { id: 'chk-r-y1', memberId: 'mem-r-1', dayOffset: -1, status: 'photo', imageData: PHOTOS.bookTable, note: '따뜻한 차랑 한 챕터 마무리', timestampLabel: '10:02 PM', likesCount: 1, likedByMe: false },
        { id: 'chk-r-yme', memberId: 'mem-r-me', dayOffset: -1, status: 'photo', imageData: PHOTOS.bookCoffee, note: '침대 머리맡에서 15분 독서', timestampLabel: '10:15 PM', likesCount: 2, likedByMe: false },
      ],
    },

    // 3. Joined room: 3 members, 1 completed today (33%), user_me pending
    {
      id: 'room-coding',
      title: '퇴근 후 사이드 작업실',
      tag: '#사이드프로젝트',
      category: 'study',
      maxCapacity: 4,
      streakDays: 8,
      lastCompletedDate: yesterday,
      members: [
        { id: 'mem-c-1', userId: 'u-hyunwoo', nickname: '현우', avatarInitial: '현', isCurrentUser: false, isHost: true, memberStreakDays: 8, lastActiveOffset: 0, joinedOffset: -10 },
        { id: 'mem-c-2', userId: 'u-sumin', nickname: '수민', avatarInitial: '수', isCurrentUser: false, isHost: false, memberStreakDays: 6, lastActiveOffset: -1, joinedOffset: -8 },
        { id: 'mem-c-me', userId: 'user_me', nickname: '나', avatarInitial: '나', isCurrentUser: true, isHost: false, memberStreakDays: 8, lastActiveOffset: -1, joinedOffset: -10 },
      ],
      checkins: [
        { id: 'chk-c-t1', memberId: 'mem-c-1', dayOffset: 0, status: 'photo', imageData: PHOTOS.laptopDesk, note: 'API 설계 문서 정리 끝!', timestampLabel: '08:40 PM', likesCount: 1, likedByMe: false },
        { id: 'chk-c-y1', memberId: 'mem-c-1', dayOffset: -1, status: 'photo', imageData: PHOTOS.laptopDesk, note: '결제 모듈 테스트 코드 작성', timestampLabel: '09:15 PM', likesCount: 2, likedByMe: false },
        { id: 'chk-c-y2', memberId: 'mem-c-2', dayOffset: -1, status: 'photo', imageData: PHOTOS.bookTable, note: '디자인 토큰 컬러 정리 완료', timestampLabel: '09:30 PM', likesCount: 1, likedByMe: false },
        { id: 'chk-c-yme', memberId: 'mem-c-me', dayOffset: -1, status: 'photo', imageData: PHOTOS.laptopDesk, note: 'UI 버그 2개 수정하고 커밋', timestampLabel: '10:05 PM', likesCount: 2, likedByMe: false },
      ],
    },

    // 4. Explore room (3/4 almost full)
    {
      id: 'room-exp-drawing',
      title: '하루 15분 크로키 함께 그려요',
      tag: '#드로잉',
      category: 'drawing',
      maxCapacity: 4,
      streakDays: 7,
      lastCompletedDate: yesterday,
      members: [
        { id: 'mem-ed-1', userId: 'u-yuna', nickname: '유나', avatarInitial: '유', isCurrentUser: false, isHost: true, memberStreakDays: 7, lastActiveOffset: 0, joinedOffset: -9 },
        { id: 'mem-ed-2', userId: 'u-junho', nickname: '준호', avatarInitial: '준', isCurrentUser: false, isHost: false, memberStreakDays: 7, lastActiveOffset: 0, joinedOffset: -9 },
        { id: 'mem-ed-3', userId: 'u-dahye', nickname: '다혜', avatarInitial: '다', isCurrentUser: false, isHost: false, memberStreakDays: 5, lastActiveOffset: -1, joinedOffset: -6 },
      ],
      checkins: [
        { id: 'chk-ed-1', memberId: 'mem-ed-1', dayOffset: 0, status: 'photo', imageData: PHOTOS.notebookCoffee, note: '인물 크로키 3장 빠르게 연습', timestampLabel: '08:10 PM', likesCount: 3, likedByMe: false },
        { id: 'chk-ed-2', memberId: 'mem-ed-2', dayOffset: 0, status: 'photo', imageData: PHOTOS.bookTable, note: '카페 컵 스케치 한 장', timestampLabel: '08:45 PM', likesCount: 2, likedByMe: false },
      ],
    },

    // 5. Explore room (3/4 almost full)
    {
      id: 'room-exp-walk',
      title: '저녁 산책 3천 보 가볍게 걸어요',
      tag: '#산책',
      category: 'exercise',
      maxCapacity: 4,
      streakDays: 5,
      lastCompletedDate: yesterday,
      members: [
        { id: 'mem-ew-1', userId: 'u-haneul', nickname: '하늘', avatarInitial: '하', isCurrentUser: false, isHost: true, memberStreakDays: 5, lastActiveOffset: 0, joinedOffset: -7 },
        { id: 'mem-ew-2', userId: 'u-minseok', nickname: '민석', avatarInitial: '민', isCurrentUser: false, isHost: false, memberStreakDays: 4, lastActiveOffset: 0, joinedOffset: -6 },
        { id: 'mem-ew-3', userId: 'u-chae', nickname: '채원', avatarInitial: '채', isCurrentUser: false, isHost: false, memberStreakDays: 3, lastActiveOffset: -1, joinedOffset: -5 },
      ],
      checkins: [
        { id: 'chk-ew-1', memberId: 'mem-ew-1', dayOffset: 0, status: 'photo', imageData: PHOTOS.running, note: '밤 공기 마시며 공원 한 바퀴', timestampLabel: '08:30 PM', likesCount: 2, likedByMe: false },
        { id: 'chk-ew-2', memberId: 'mem-ew-2', dayOffset: 0, status: 'photo', imageData: PHOTOS.cardio, note: '4,200보 걷기 완료!', timestampLabel: '09:05 PM', likesCount: 1, likedByMe: false },
      ],
    },

    // 6. Explore room (2/4)
    {
      id: 'room-exp-cert',
      title: '퇴근 후 1시간 자격증 공부해요',
      tag: '#자격증',
      category: 'study',
      maxCapacity: 4,
      streakDays: 6,
      lastCompletedDate: yesterday,
      members: [
        { id: 'mem-ec-1', userId: 'u-dohyun', nickname: '도현', avatarInitial: '도', isCurrentUser: false, isHost: true, memberStreakDays: 6, lastActiveOffset: 0, joinedOffset: -8 },
        { id: 'mem-ec-2', userId: 'u-sua', nickname: '수아', avatarInitial: '수', isCurrentUser: false, isHost: false, memberStreakDays: 5, lastActiveOffset: -1, joinedOffset: -6 },
      ],
      checkins: [
        { id: 'chk-ec-1', memberId: 'mem-ec-1', dayOffset: 0, status: 'photo', imageData: PHOTOS.laptopDesk, note: '기출문제 2회독 마무리 중', timestampLabel: '08:50 PM', likesCount: 2, likedByMe: false },
      ],
    },

    // 7. Explore room (1/4 solo waiting for first mate)
    {
      id: 'room-exp-morning',
      title: '아침 7시 책 한 챕터 & 따뜻한 차',
      tag: '#아침루틴',
      category: 'reading',
      maxCapacity: 4,
      streakDays: 2,
      lastCompletedDate: yesterday,
      members: [
        { id: 'mem-em-1', userId: 'u-bora', nickname: '보라', avatarInitial: '보', isCurrentUser: false, isHost: true, memberStreakDays: 2, lastActiveOffset: 0, joinedOffset: -3 },
      ],
      checkins: [
        { id: 'chk-em-1', memberId: 'mem-em-1', dayOffset: 0, status: 'photo', imageData: PHOTOS.bookCoffee, note: '상쾌하게 하루 시작! 오늘도 화이팅', timestampLabel: '07:25 AM', likesCount: 4, likedByMe: false },
      ],
    },
  ];
}

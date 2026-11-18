'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BottomNav } from './BottomNav';
import { CheckIcon, LogOutIcon, SproutIcon } from './Icons';
import { MiniPolaroid } from './MiniPolaroid';
import type { RoomSummary, WeekRhythmDay } from '@/types/ongi';

export function HomeClient({
  initialMyRooms: rooms,
  weekRhythm,
  userNickname,
}: {
  initialMyRooms: RoomSummary[];
  weekRhythm: WeekRhythmDay[];
  userNickname: string;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const pending = rooms.filter(
    (room) => room.myStatusToday === 'pending'
  ).length;
  const today = weekRhythm.find((day) => day.isToday);
  async function logout() {
    setLoggingOut(true);
    try {
      const result = await fetch('/api/auth/logout', { method: 'POST' });
      if (!result.ok) throw new Error();
      router.replace('/auth');
      router.refresh();
    } catch {
      setError('로그아웃하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <div className="app-page">
      <main className="journal-content">
        <header className="page-title">
          <div>
            <p className="kicker">
              {today?.date.replaceAll('-', '. ')} · {userNickname}님의 기록
            </p>
            <h1>
              {!rooms.length
                ? '누구와 함께 시작할까요?'
                : pending
                  ? '오늘의 내 방'
                  : '오늘 기록을 다 남겼어요.'}
            </h1>
          </div>
          <button className="quiet" onClick={logout} disabled={loggingOut}>
            <LogOutIcon />
            로그아웃
          </button>
        </header>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <section className="week-strip">
          <h2>이번 주 기록</h2>
          <ol>
            {weekRhythm.map((day) => (
              <li
                key={day.date}
                className={day.isToday ? 'today' : ''}
                aria-label={day.date + (day.done ? ' 기록 완료' : ' 기록 없음')}
              >
                <span>{day.label}</span>
                <i className={day.done ? 'done' : ''}>
                  {day.done ? <CheckIcon /> : '·'}
                </i>
              </li>
            ))}
          </ol>
        </section>
        <div className="section-heading">
          <h2>
            함께하는 방 <small>{rooms.length}</small>
          </h2>
          <Link href="/explore">방 둘러보기 →</Link>
        </div>
        {rooms.length ? (
          <div className="room-list">
            {rooms.map((room) => (
              <Link
                className="room-card"
                key={room.id}
                href={'/rooms/' + room.id}
              >
                <div className="room-row">
                  <MiniPolaroid tiles={room.previewTiles} />
                  <div className="room-info">
                    <p className="kicker">
                      {room.tag} · 연속 {room.streakDays}일
                    </p>
                    <h3>{room.title}</h3>
                  </div>
                </div>
                <div className="progress-line">
                  <span>
                    {room.completedCount}/{room.memberCount}명 기록
                  </span>
                  <span>{room.completionPercent}%</span>
                </div>
                <progress
                  value={room.completionPercent}
                  max={100}
                  aria-label="오늘 방 달성률"
                />
                <p className="room-action">
                  {room.myStatusToday === 'pending'
                    ? '오늘 사진 남기기 →'
                    : room.myStatusToday === 'rest'
                      ? '오늘은 쉬어가는 날'
                      : '오늘 기록 보기 →'}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <section className="empty-paper">
            <SproutIcon size={34} />
            <h3>아직 함께하는 방이 없어요.</h3>
            <p>해보고 싶었던 일로 방을 찾아보세요. 오늘 멤버들이 무엇을 했는지 볼 수 있어요.</p>
            <Link className="primary" href="/explore">
              내게 맞는 방 찾기
            </Link>
          </section>
        )}
      </main>
      <BottomNav active="home" />
    </div>
  );
}

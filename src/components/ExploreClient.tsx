'use client';

import Link from 'next/link';
import { JournalDialog } from './JournalDialog';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { CategoryIcon, PlusIcon, SearchIcon } from '@/components/Icons';
import type { RoomCapacity, RoomSummary } from '@/types/ongi';

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'almost', label: '한 자리 남았어요', sage: true },
  { key: 'exercise', label: '#운동·산책' },
  { key: 'reading', label: '#독서·글쓰기' },
  { key: 'drawing', label: '#드로잉·취미' },
  { key: 'study', label: '#공부·작업' },
];

export function ExploreClient({
  initialRooms,
}: {
  initialRooms: RoomSummary[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newCap, setNewCap] = useState<RoomCapacity>(4);
  const [creating, setCreating] = useState(false);

  const search = query.trim().toLowerCase();
  const rooms = initialRooms.filter((room) => {
    if (activeFilter === 'almost' && room.maxCapacity - room.memberCount !== 1)
      return false;
    if (
      !['all', 'almost'].includes(activeFilter) &&
      room.category !== activeFilter &&
      !room.tag.toLowerCase().includes(activeFilter)
    )
      return false;
    return (
      room.title.toLowerCase().includes(search) ||
      room.tag.toLowerCase().includes(search)
    );
  });

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newTag.trim()) {
      setErrorMsg('방 이름과 주제 태그를 모두 입력해 주세요.');
      return;
    }
    setCreating(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          tag: newTag.trim(),
          maxCapacity: newCap,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || '새 방을 만들지 못했어요.');
        return;
      }
      setSheetOpen(false);
      router.push(`/rooms/${json.room.room.id}`);
      router.refresh();
    } catch {
      setErrorMsg('방을 열지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="app-page">
      <main className="journal-content">
        <header className="page-title">
          <div>
            <h1>함께할 방 찾기</h1>
            <p>들이고 싶은 습관을 골라 보세요. 먼저 시작한 사람들의 방을 구경할 수 있어요.</p>
          </div>
          <button
            className="primary"
            onClick={() => {
              setErrorMsg(null);
              setSheetOpen(true);
            }}
          >
            <PlusIcon />방 만들기
          </button>
        </header>
        <div className="explore-tools">
          <label className="search-field">
            <SearchIcon />
            <input
              type="search"
              aria-label="방 이름 또는 태그 검색"
              placeholder="방 이름이나 태그로 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="chips">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                aria-pressed={activeFilter === f.key}
                onClick={() => setActiveFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="section-heading">
          <h2>
            빈자리가 있는 방 <small>{rooms.length}</small>
          </h2>
        </div>
        {rooms.length ? (
          <div className="room-list">
            {rooms.map((room) => (
              <Link
                key={room.id}
                className="room-card"
                href={'/rooms/' + room.id}
              >
                <div className="room-row">
                  <span className="topic-icon">
                    <CategoryIcon category={room.category} size={26} />
                  </span>
                  <div className="room-info">
                    <p className="kicker">{room.tag}</p>
                    <h3>{room.title}</h3>
                  </div>
                </div>
                <div className="room-meta">
                  <span>
                    {room.memberCount}/{room.maxCapacity}명 · 빈자리{' '}
                    {room.maxCapacity - room.memberCount}개
                  </span>
                  <strong>미리보기 →</strong>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <section className="empty-paper">
            <h3>
              {initialRooms.length
                ? '조건에 맞는 방이 없어요.'
                : '아직 모집 중인 방이 없어요.'}
            </h3>
            {initialRooms.length > 0 && (
              <button
                className="secondary"
                onClick={() => {
                  setQuery('');
                  setActiveFilter('all');
                }}
              >
                전체 방 보기
              </button>
            )}
            <button
              className="primary"
              onClick={() => {
                setErrorMsg(null);
                setSheetOpen(true);
              }}
            >
              새 방 만들기
            </button>
          </section>
        )}
      </main>
      <BottomNav active="explore" />
      {sheetOpen && (
        <JournalDialog
          title="새 방 만들기"
          busy={creating}
          onClose={() => setSheetOpen(false)}
        >
          <form onSubmit={handleCreateRoom} className="stack">
            <label>
              방 이름
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="예) 저녁마다 책 세 쪽"
              />
            </label>
            <label>
              주제 태그
              <input
                required
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="예) #저녁독서"
              />
            </label>
            <fieldset>
              <legend>함께할 인원</legend>
              <div className="chips">
                {([2, 4, 6] as const).map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    aria-pressed={newCap === cap}
                    onClick={() => setNewCap(cap)}
                  >
                    {cap}명
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="hint">
              하루에 한 번 사진을 남겨요. 방마다 일주일에 한 번은 쉬어갈 수
              있어요. 3일 연속 기록이 없으면 멤버가 자동 정리될 수 있어요.
            </p>
            {errorMsg && (
              <p className="error" role="alert">
                {errorMsg}
              </p>
            )}
            <button className="primary" disabled={creating}>
              {creating ? '방을 여는 중…' : '방 열기'}
            </button>
          </form>
        </JournalDialog>
      )}
    </div>
  );
}

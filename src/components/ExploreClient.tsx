'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import {
  CategoryIcon,
  PlusIcon,
  SearchIcon,
} from '@/components/Icons';
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
  const [rooms, setRooms] = useState<RoomSummary[]>(initialRooms);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newCap, setNewCap] = useState<RoomCapacity>(4);
  const [creating, setCreating] = useState(false);

  const refreshExplore = async (nextQuery: string, nextFilter: string) => {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set('query', nextQuery.trim());
    if (nextFilter !== 'all') params.set('filter', nextFilter);
    const res = await fetch(`/api/rooms?${params.toString()}`);
    if (!res.ok) return;
    const json = await res.json();
    setRooms(json.exploreRooms as RoomSummary[]);
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    void refreshExplore(val, activeFilter);
  };

  const handleFilterClick = (key: string) => {
    setActiveFilter(key);
    void refreshExplore(query, key);
  };

  const handleJoin = async (roomId: string) => {
    setJoiningId(roomId);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || '방 참여에 실패했어요.');
        return;
      }
      router.push(`/rooms/${roomId}`);
      router.refresh();
    } finally {
      setJoiningId(null);
    }
  };

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
    } finally {
      setCreating(false);
    }
  };

  const toneForCategory = (cat: string) => {
    if (cat === 'exercise') return { bg: 'var(--accent-sage-soft)', color: 'var(--accent-sage)' };
    if (cat === 'reading') return { bg: 'var(--accent-honey-soft)', color: '#A97014' };
    return { bg: 'var(--accent-coral-soft)', color: 'var(--accent-coral)' };
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="screen-scroll">
        <header>
          <h1
            style={{
              fontSize: '1.18rem',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              lineHeight: 1.32,
              color: 'var(--ink-primary)',
            }}
          >
            어떤 작은 모임에
            <br />
            마음을 보탤까요?
          </h1>
        </header>

        {/* Search Input */}
        <div
          className="card-ivory"
          style={{
            borderRadius: '16px',
            padding: '10px 13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <SearchIcon size={16} style={{ color: 'var(--ink-secondary)', flexShrink: 0 }} />
          <input
            type="search"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="함께하고 싶은 취미나 습관을 찾아보세요"
            style={{
              border: 'none',
              background: 'transparent',
              width: '100%',
              fontFamily: 'inherit',
              fontSize: '0.8rem',
              color: 'var(--ink-primary)',
              outline: 'none',
            }}
          />
        </div>

        {/* Filter Chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTERS.map(chip => {
            const active = activeFilter === chip.key;
            const bg = active
              ? chip.sage
                ? 'var(--accent-sage)'
                : 'var(--accent-coral)'
              : 'var(--surface)';
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => handleFilterClick(chip.key)}
                style={{
                  border: active
                    ? `1px solid ${bg}`
                    : '1px solid var(--border-soft)',
                  background: bg,
                  color: active ? '#fff' : 'var(--ink-secondary)',
                  fontFamily: 'inherit',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '6px 11px',
                  borderRadius: '999px',
                  cursor: 'pointer',
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {errorMsg && (
          <div
            style={{
              background: '#FFF0EB',
              border: '1px solid #F29C85',
              color: '#A5351E',
              borderRadius: '12px',
              padding: '8px 11px',
              fontSize: '0.74rem',
              fontWeight: 700,
            }}
          >
            {errorMsg}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--ink-primary)',
          }}
        >
          <span>바로 시작할 수 있는 다정한 방</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', fontWeight: 600 }}>
            빈자리 우선 추천
          </span>
        </div>

        {rooms.length === 0 ? (
          <div
            className="card-ivory"
            style={{
              padding: '24px 14px',
              textAlign: 'center',
              fontSize: '0.78rem',
              color: 'var(--ink-secondary)',
            }}
          >
            조건에 맞는 빈자리 방이 없어요.
            <br />
            아래 버튼으로 나만의 방을 바로 열어보세요!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {rooms.map(room => {
              const tone = toneForCategory(room.category);
              const openSlots = room.maxCapacity - room.memberCount;
              return (
                <div
                  key={room.id}
                  className="card-ivory"
                  style={{
                    borderRadius: '19px',
                    padding: '12px 13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '13px',
                      background: tone.bg,
                      color: tone.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CategoryIcon category={room.category} size={18} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        color: 'var(--accent-coral)',
                      }}
                    >
                      {room.tag}
                    </div>
                    <div
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        color: 'var(--ink-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        margin: '1px 0 3px',
                      }}
                    >
                      {room.title}
                    </div>
                    <div style={{ fontSize: '0.67rem', color: 'var(--ink-secondary)' }}>
                      {room.memberCount}/{room.maxCapacity}명 참여 중 ·{' '}
                      <strong style={{ color: 'var(--accent-sage)' }}>
                        {openSlots === 1
                          ? '한 자리 비었어요'
                          : room.memberCount === 1
                            ? '첫 메이트를 기다려요'
                            : `Day ${room.streakDays} 순항 중`}
                      </strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={joiningId === room.id}
                    onClick={() => handleJoin(room.id)}
                    style={{
                      border: 'none',
                      background: 'var(--accent-coral)',
                      color: '#fff',
                      fontFamily: 'inherit',
                      fontSize: '0.71rem',
                      fontWeight: 700,
                      padding: '7px 12px',
                      borderRadius: '999px',
                      cursor: joiningId === room.id ? 'wait' : 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 3px 9px rgba(238, 99, 72, 0.24)',
                    }}
                  >
                    {joiningId === room.id ? '참여 중...' : '함께하기'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          style={{
            width: '100%',
            background: 'var(--accent-honey-soft)',
            border: '1.5px dashed #E4B75B',
            color: '#825711',
            borderRadius: '18px',
            padding: '12px 14px',
            fontFamily: 'inherit',
            fontSize: '0.78rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            marginTop: '2px',
          }}
        >
          <PlusIcon size={15} />
          <span>새로운 다정한 방 만들기</span>
        </button>
      </div>

      {/* Create Room Bottom Sheet */}
      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="새 자기계발 방 열기"
          onClick={e => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(40, 31, 26, 0.42)',
            zIndex: 45,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          <form
            onSubmit={handleCreateRoom}
            style={{
              background: 'var(--surface)',
              borderRadius: '26px 26px 0 0',
              padding: '16px 18px 24px',
              borderTop: '1px solid var(--border-soft)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '4px',
                borderRadius: '999px',
                background: 'var(--border-soft)',
                margin: '0 auto',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 800 }}>새 자기계발 방 열기</h3>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                style={{
                  border: 'none',
                  background: 'var(--surface-tint)',
                  color: 'var(--ink-secondary)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '5px 11px',
                  borderRadius: '999px',
                  cursor: 'pointer',
                }}
              >
                닫기
              </button>
            </div>

            <div>
              <label
                htmlFor="new-room-title"
                style={{
                  display: 'block',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--ink-secondary)',
                  marginBottom: '5px',
                }}
              >
                어떤 습관을 함께할까요?
              </label>
              <input
                id="new-room-title"
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="예) 매일 저녁 영어 원서 3쪽 읽기"
                style={{
                  width: '100%',
                  background: 'var(--phone-bg)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: '12px',
                  padding: '9px 11px',
                  fontFamily: 'inherit',
                  fontSize: '0.8rem',
                  color: 'var(--ink-primary)',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="new-room-tag"
                style={{
                  display: 'block',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--ink-secondary)',
                  marginBottom: '5px',
                }}
              >
                주제 태그 (무제한 자유 입력)
              </label>
              <input
                id="new-room-tag"
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                placeholder="예) #영어원서"
                style={{
                  width: '100%',
                  background: 'var(--phone-bg)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: '12px',
                  padding: '9px 11px',
                  fontFamily: 'inherit',
                  fontSize: '0.8rem',
                  color: 'var(--ink-primary)',
                }}
              />
            </div>

            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--ink-secondary)',
                  marginBottom: '6px',
                }}
              >
                방 정원 (인원에 맞춰 분할 보드가 자동 조절돼요)
              </span>
              <div style={{ display: 'flex', gap: '7px' }}>
                {([2, 4, 6] as RoomCapacity[]).map(cap => {
                  const active = newCap === cap;
                  return (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setNewCap(cap)}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: '11px',
                        border: active
                          ? '1.5px solid var(--accent-coral)'
                          : '1px solid var(--border-soft)',
                        background: active
                          ? 'var(--accent-coral-soft)'
                          : 'var(--phone-bg)',
                        fontFamily: 'inherit',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        color: active ? 'var(--accent-coral)' : 'var(--ink-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {cap}명
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              style={{
                width: '100%',
                border: 'none',
                background: 'var(--accent-coral)',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '0.82rem',
                fontWeight: 800,
                padding: '11px',
                borderRadius: '15px',
                cursor: creating ? 'wait' : 'pointer',
                boxShadow: '0 6px 14px rgba(238, 99, 72, 0.28)',
              }}
            >
              {creating ? '방을 여는 중...' : '다정한 방 열기'}
            </button>
          </form>
        </div>
      )}

      <BottomNav active="explore" />
    </div>
  );
}

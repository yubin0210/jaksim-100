'use client';

import { useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import {
  AlbumIcon,
  CalendarIcon,
  CloudIcon,
  HeartIcon,
} from '@/components/Icons';
import type { AlbumEntry, AlbumResponse } from '@/types/ongi';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  if (!year || !month) return monthStr;
  return `${year}년 ${Number(month)}월`;
}

export function AlbumClient({ initialAlbum }: { initialAlbum: AlbumResponse }) {
  const [album, setAlbum] = useState<AlbumResponse>(initialAlbum);
  const [selectedMonth, setSelectedMonth] = useState(initialAlbum.month);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [lightboxEntries, setLightboxEntries] = useState<AlbumEntry[] | null>(
    null
  );

  const fetchAlbum = async (nextMonth: string, nextRoomId: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('month', nextMonth);
      if (nextRoomId) {
        params.set('roomId', nextRoomId);
      }
      const res = await fetch(`/api/album?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as AlbumResponse;
      setAlbum(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMonth = (nextMonth: string) => {
    setSelectedMonth(nextMonth);
    void fetchAlbum(nextMonth, selectedRoomId);
  };

  const handleSelectRoom = (nextRoomId: string) => {
    setSelectedRoomId(nextRoomId);
    void fetchAlbum(selectedMonth, nextRoomId);
  };

  const [yearNum, monthNum] = album.month.split('-').map(Number);
  const year = yearNum || new Date().getFullYear();
  const monthIndex = (monthNum || 1) - 1;
  const firstDayOffset = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const entriesByDate = new Map<string, AlbumEntry[]>();
  for (const entry of album.entries) {
    const existing = entriesByDate.get(entry.checkinDate) ?? [];
    existing.push(entry);
    entriesByDate.set(entry.checkinDate, existing);
  }

  const leadingEmptyCells = Array.from({ length: firstDayOffset }, (_, i) => i);
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

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
        {/* Header */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.73rem',
                fontWeight: 600,
                color: 'var(--ink-secondary)',
                marginBottom: '3px',
              }}
            >
              <AlbumIcon size={13} style={{ color: 'var(--accent-coral)' }} />
              <span>나의 자기계발 아카이브</span>
            </div>
            <h1
              style={{
                fontSize: '1.18rem',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.32,
                color: 'var(--ink-primary)',
              }}
            >
              차곡차곡 쌓인
              <br />
              나의 온기 앨범
            </h1>
          </div>

          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: '999px',
              padding: '5px 11px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--ink-secondary)',
              whiteSpace: 'nowrap',
              boxShadow: '0 3px 8px rgba(68, 48, 34, 0.04)',
            }}
          >
            이번 달{' '}
            <strong
              className="serif-num"
              style={{ color: 'var(--accent-coral)', fontSize: '0.84rem' }}
            >
              {album.entries.length}
            </strong>
            조각
          </div>
        </header>

        {/* Month Selector */}
        <div
          aria-label="월 선택"
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            paddingBottom: '2px',
          }}
        >
          {album.availableMonths.map(monthStr => {
            const active = selectedMonth === monthStr;
            return (
              <button
                key={monthStr}
                type="button"
                onClick={() => handleSelectMonth(monthStr)}
                style={{
                  border: active
                    ? '1px solid var(--accent-coral)'
                    : '1px solid var(--border-soft)',
                  background: active ? 'var(--accent-coral)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--ink-secondary)',
                  fontFamily: 'inherit',
                  fontSize: '0.71rem',
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <CalendarIcon size={12} />
                <span>{formatMonthLabel(monthStr)}</span>
              </button>
            );
          })}
        </div>

        {/* Room Filter Chips */}
        <div
          aria-label="방 필터"
          style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => handleSelectRoom('')}
            style={{
              border:
                selectedRoomId === ''
                  ? '1px solid var(--accent-sage)'
                  : '1px solid var(--border-soft)',
              background:
                selectedRoomId === '' ? 'var(--accent-sage)' : 'var(--surface)',
              color: selectedRoomId === '' ? '#fff' : 'var(--ink-secondary)',
              fontFamily: 'inherit',
              fontSize: '0.69rem',
              fontWeight: 700,
              padding: '5px 11px',
              borderRadius: '999px',
              cursor: 'pointer',
            }}
          >
            전체 방
          </button>
          {album.rooms.map(room => {
            const active = selectedRoomId === room.id;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => handleSelectRoom(room.id)}
                style={{
                  border: active
                    ? '1px solid var(--accent-sage)'
                    : '1px solid var(--border-soft)',
                  background: active ? 'var(--accent-sage)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--ink-secondary)',
                  fontFamily: 'inherit',
                  fontSize: '0.69rem',
                  fontWeight: 700,
                  padding: '5px 11px',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  maxWidth: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {room.tag} {room.title}
              </button>
            );
          })}
        </div>

        {/* Monthly Calendar Grid */}
        <section
          aria-label="월간 인증 달력"
          className="card-ivory"
          style={{
            padding: '13px 12px',
            borderRadius: '22px',
            opacity: loading ? 0.72 : 1,
            transition: 'opacity 0.2s ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              padding: '0 2px',
            }}
          >
            <span
              className="serif-num"
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: 'var(--ink-primary)',
              }}
            >
              {formatMonthLabel(album.month)}
            </span>
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 600,
                color: 'var(--ink-muted)',
              }}
            >
              날짜를 누르면 그날의 폴라로이드가 열려요
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '5px',
              marginBottom: '6px',
            }}
          >
            {WEEKDAYS.map((day, idx) => (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  color:
                    idx === 0
                      ? 'var(--accent-coral)'
                      : 'var(--ink-muted)',
                }}
              >
                {day}
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '5px',
            }}
          >
            {leadingEmptyCells.map(idx => (
              <div key={`empty-${idx}`} style={{ aspectRatio: '1 / 1.15' }} />
            ))}

            {dayNumbers.map(dayNum => {
              const dateStr = `${album.month}-${String(dayNum).padStart(2, '0')}`;
              const dayEntries = entriesByDate.get(dateStr) ?? [];
              const photoEntry = dayEntries.find(
                e => e.status === 'photo' && e.imageData
              );
              const hasEntries = dayEntries.length > 0;

              if (!hasEntries) {
                return (
                  <div
                    key={dateStr}
                    style={{
                      aspectRatio: '1 / 1.15',
                      borderRadius: '11px',
                      background: 'var(--phone-bg)',
                      border: '1px solid rgba(230, 217, 199, 0.55)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      color: 'var(--ink-muted)',
                    }}
                  >
                    {dayNum}
                  </div>
                );
              }

              if (photoEntry && photoEntry.imageData) {
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setLightboxEntries(dayEntries)}
                    aria-label={`${dateStr} 인증 기록 ${dayEntries.length}건 보기`}
                    style={{
                      aspectRatio: '1 / 1.15',
                      borderRadius: '11px',
                      padding: '2.5px',
                      background: '#FFFDF9',
                      border: '1.5px solid var(--border-warm)',
                      boxShadow: '0 3px 8px rgba(68, 48, 34, 0.08)',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                    }}
                  >
                    <img
                      src={photoEntry.imageData}
                      alt={`${dateStr} 인증 썸네일`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        display: 'block',
                      }}
                    />
                    <span
                      className="serif-num"
                      style={{
                        position: 'absolute',
                        top: '4px',
                        left: '4px',
                        background: 'rgba(255, 253, 249, 0.9)',
                        color: 'var(--ink-primary)',
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        padding: '1px 4px',
                        borderRadius: '999px',
                        lineHeight: 1.2,
                      }}
                    >
                      {dayNum}
                    </span>
                    {dayEntries.length > 1 && (
                      <span
                        className="serif-num"
                        style={{
                          position: 'absolute',
                          bottom: '4px',
                          right: '4px',
                          background: 'var(--accent-coral)',
                          color: '#fff',
                          fontSize: '0.56rem',
                          fontWeight: 700,
                          padding: '1px 4px',
                          borderRadius: '999px',
                          lineHeight: 1.2,
                        }}
                      >
                        +{dayEntries.length - 1}
                      </span>
                    )}
                  </button>
                );
              }

              // Only rest entries on this date
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setLightboxEntries(dayEntries)}
                  aria-label={`${dateStr} 휴식권 기록 보기`}
                  style={{
                    aspectRatio: '1 / 1.15',
                    borderRadius: '11px',
                    background: 'var(--accent-honey-soft)',
                    border: '1.5px solid #ECCB7B',
                    color: '#8E5F12',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <span
                    className="serif-num"
                    style={{ fontSize: '0.6rem', fontWeight: 700, lineHeight: 1 }}
                  >
                    {dayNum}
                  </span>
                  <CloudIcon size={12} />
                </button>
              );
            })}
          </div>
        </section>

        {/* Recent Polaroid List */}
        <section
          aria-label="이번 달 기록 목록"
          style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}
        >
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
            <span>남겨둔 순간들</span>
            <span
              style={{
                fontSize: '0.67rem',
                color: 'var(--ink-muted)',
                fontWeight: 600,
              }}
            >
              최신순
            </span>
          </div>

          {album.entries.length === 0 ? (
            <div
              className="card-ivory"
              style={{
                padding: '24px 14px',
                textAlign: 'center',
                fontSize: '0.76rem',
                color: 'var(--ink-secondary)',
              }}
            >
              선택한 조건에 저장된 인증 조각이 아직 없어요.
              <br />
              방에서 오늘의 첫 폴라로이드를 남겨보세요!
            </div>
          ) : (
            album.entries.map(entry => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setLightboxEntries([entry])}
                className="card-ivory"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  cursor: 'pointer',
                }}
              >
                {entry.status === 'photo' && entry.imageData ? (
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '1px solid var(--border-soft)',
                      background: '#F4DFCE',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={entry.imageData}
                      alt={entry.roomTitle}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '12px',
                      background: 'var(--accent-honey-soft)',
                      border: '1px solid #ECCB7B',
                      color: '#8E5F12',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CloudIcon size={20} />
                  </div>
                )}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '2px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: 'var(--accent-coral)',
                      }}
                    >
                      {entry.tag}
                    </span>
                    <span
                      className="serif-num"
                      style={{
                        fontSize: '0.64rem',
                        fontWeight: 600,
                        color: 'var(--ink-muted)',
                      }}
                    >
                      {entry.checkinDate} · {entry.timestampLabel}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      color: 'var(--ink-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {entry.roomTitle}
                  </div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--ink-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '1px',
                    }}
                  >
                    {entry.note}
                  </div>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: 'var(--accent-coral)',
                    background: 'var(--accent-coral-soft)',
                    padding: '4px 8px',
                    borderRadius: '999px',
                    flexShrink: 0,
                  }}
                >
                  <HeartIcon size={12} filled />
                  <span className="serif-num">{entry.likesCount}</span>
                </div>
              </button>
            ))
          )}
        </section>
      </div>

      {/* Polaroid Lightbox Modal */}
      {lightboxEntries && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="선택한 날짜 폴라로이드 상세"
          onClick={e => {
            if (e.target === e.currentTarget) setLightboxEntries(null);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(40, 31, 26, 0.56)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '18px 16px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '26px',
              border: '1px solid var(--border-soft)',
              padding: '14px',
              maxHeight: '85%',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 24px 48px rgba(40, 31, 26, 0.28)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                className="serif-num"
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  color: 'var(--ink-primary)',
                }}
              >
                {lightboxEntries[0]?.checkinDate}
              </span>
              <button
                type="button"
                onClick={() => setLightboxEntries(null)}
                style={{
                  border: 'none',
                  background: 'var(--surface-tint)',
                  color: 'var(--ink-secondary)',
                  fontFamily: 'inherit',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: '999px',
                  cursor: 'pointer',
                }}
              >
                닫기
              </button>
            </div>

            {lightboxEntries.map(entry => (
              <div
                key={entry.id}
                style={{
                  background: 'var(--phone-bg)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: '20px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '9px',
                }}
              >
                {entry.status === 'photo' && entry.imageData ? (
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '4 / 5',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      background: '#F4DFCE',
                    }}
                  >
                    <img
                      src={entry.imageData}
                      alt={entry.roomTitle}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: '14px',
                      border: '1.5px solid #EBD6A2',
                      background:
                        'linear-gradient(155deg, #FFFDF5 0%, #FFF4D9 100%)',
                      padding: '28px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: '#FFE8B3',
                        color: '#9A640E',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CloudIcon size={20} />
                    </div>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        color: '#6B4911',
                      }}
                    >
                      오늘은 잠시 쉬어가는 날
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#8F6929' }}>
                      휴식 스티커로 연속 흐름을 지켰어요
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '2px 2px 0',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '2px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.67rem',
                          fontWeight: 700,
                          color: 'var(--accent-coral)',
                        }}
                      >
                        {entry.tag}
                      </span>
                      <span
                        className="serif-num"
                        style={{
                          fontSize: '0.67rem',
                          fontWeight: 700,
                          color: 'var(--ink-muted)',
                        }}
                      >
                        {entry.timestampLabel}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        color: 'var(--ink-primary)',
                      }}
                    >
                      {entry.roomTitle}
                    </div>
                    <div
                      style={{
                        fontSize: '0.74rem',
                        color: 'var(--ink-secondary)',
                        marginTop: '3px',
                        lineHeight: 1.4,
                      }}
                    >
                      {entry.note}
                    </div>
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'var(--accent-coral)',
                      background: 'var(--accent-coral-soft)',
                      padding: '4px 9px',
                      borderRadius: '999px',
                      flexShrink: 0,
                    }}
                  >
                    <HeartIcon size={12} filled />
                    <span className="serif-num">{entry.likesCount}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <BottomNav active="album" />
    </div>
  );
}

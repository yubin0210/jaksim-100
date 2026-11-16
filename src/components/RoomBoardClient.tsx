'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  CloudIcon,
  FlameIcon,
  HeartIcon,
} from '@/components/Icons';
import { LiveCameraModal } from '@/components/LiveCameraModal';
import type { DailyCheckin, RoomDetailResponse } from '@/types/ongi';

export function RoomBoardClient({
  initialDetail,
}: {
  initialDetail: RoomDetailResponse;
}) {
  const [detail, setDetail] = useState<RoomDetailResponse>(initialDetail);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isToday = detail.selectedDate === detail.today;
  const checkinByMember = new Map<string, DailyCheckin>(
    detail.checkins.map(c => [c.memberId, c])
  );

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  const handleSelectDate = async (dateStr: string) => {
    setCalendarOpen(false);
    setErrorMsg(null);
    const res = await fetch(`/api/rooms/${detail.room.id}?date=${encodeURIComponent(dateStr)}`);
    if (!res.ok) return;
    const data = (await res.json()) as RoomDetailResponse;
    setDetail(data);
  };

  const handleCapture = async (payload: {
    imageData: string;
    note: string;
    timestampLabel: string;
  }) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/rooms/${detail.room.id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || '인증 업로드에 실패했어요.');
        return;
      }
      setDetail(json.room as RoomDetailResponse);
      setCameraOpen(false);
      if ((json.room as RoomDetailResponse).completion.isComplete) {
        showToast('오늘 우리 방 보드 100% 완성!');
      } else {
        showToast('오늘의 조각을 보드에 남겼어요!');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestPass = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/rooms/${detail.room.id}/rest`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || '휴식권을 사용할 수 없어요.');
        return;
      }
      setDetail(json.room as RoomDetailResponse);
      showToast('오늘 휴식 스티커를 붙였어요');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async (checkinId: string) => {
    const res = await fetch(`/api/checkins/${checkinId}/like`, {
      method: 'POST',
    });
    if (!res.ok) return;
    const json = await res.json();
    const updated = json.checkin as DailyCheckin;
    setDetail(prev => ({
      ...prev,
      checkins: prev.checkins.map(c => (c.id === updated.id ? updated : c)),
    }));
  };

  const gridLayoutStyle: React.CSSProperties =
    detail.layoutMode === 'single'
      ? { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
      : detail.layoutMode === 'split-2'
        ? { gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' }
        : detail.layoutMode === 'split-3'
          ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1.05fr 0.95fr' }
          : detail.layoutMode === 'grid-2x2'
            ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }
            : { gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(3, 1fr)' };

  const progressFillClass =
    detail.completion.percent === 100
      ? 'fill-sage'
      : detail.completion.percent < 50
        ? 'fill-honey'
        : 'fill-coral';

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
      {toastMsg && (
        <div
          style={{
            position: 'absolute',
            top: '56px',
            left: '16px',
            right: '16px',
            zIndex: 40,
            background: '#346B45',
            color: '#fff',
            borderRadius: '14px',
            padding: '10px 14px',
            fontSize: '0.76rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 10px 24px rgba(52, 107, 69, 0.3)',
          }}
        >
          <span>{toastMsg}</span>
          <CheckIcon size={15} />
        </div>
      )}

      {/* Single-room immersion top bar (no room switcher tabs) */}
      <header
        style={{
          padding: '14px 16px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            background: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            color: 'var(--ink-primary)',
            textDecoration: 'none',
            fontSize: '0.74rem',
            fontWeight: 700,
            padding: '6px 11px 6px 8px',
            borderRadius: '999px',
          }}
        >
          <ChevronLeftIcon size={14} />
          <span>목록으로</span>
        </Link>

        <div style={{ textAlign: 'center', minWidth: 0, flex: 1 }}>
          <h1
            style={{
              fontSize: '0.96rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--ink-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {detail.room.title}
          </h1>
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'var(--accent-coral)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <FlameIcon size={12} />
            <span className="serif-num">Day {detail.room.streakDays}</span>
            <span>함께하는 중</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          aria-label="지난 날짜 합동 포스터 보기"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <CalendarIcon size={15} />
        </button>
      </header>

      {/* Group Warmth Card */}
      <div
        className="card-ivory"
        style={{
          margin: '0 14px 10px',
          borderRadius: '18px',
          padding: '10px 13px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-primary)' }}>
            <span
              className="serif-num"
              style={{
                fontSize: '0.92rem',
                marginRight: '5px',
                color: detail.completion.isComplete
                  ? 'var(--accent-sage)'
                  : 'var(--accent-coral)',
              }}
            >
              {detail.completion.percent}%
            </span>
            <span>
              {detail.completion.isComplete
                ? `모두 도착 완료! (${detail.completion.completedCount}/${detail.completion.totalCount}명)`
                : `${detail.completion.totalCount}명 중 ${detail.completion.completedCount}명 도착`}
            </span>
            {!isToday && (
              <span
                style={{
                  marginLeft: '6px',
                  fontSize: '0.65rem',
                  color: 'var(--ink-secondary)',
                }}
              >
                ({detail.selectedDate})
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {detail.members.map(member => {
              const ch = checkinByMember.get(member.id);
              const bg = ch
                ? ch.status === 'rest'
                  ? 'var(--accent-honey-soft)'
                  : 'var(--accent-sage-soft)'
                : 'var(--accent-coral-soft)';
              const color = ch
                ? ch.status === 'rest'
                  ? '#8E5F12'
                  : '#346B45'
                : 'var(--accent-coral)';
              const border = ch
                ? ch.status === 'rest'
                  ? '1.5px solid #ECCB7B'
                  : '1.5px solid #9DD0AB'
                : '1.5px dashed var(--accent-coral)';

              return (
                <span
                  key={member.id}
                  title={member.nickname}
                  style={{
                    width: '23px',
                    height: '23px',
                    borderRadius: '50%',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: bg,
                    color,
                    border,
                  }}
                >
                  {ch ? (ch.status === 'rest' ? '쉼' : <CheckIcon size={11} />) : member.avatarInitial}
                </span>
              );
            })}
          </div>
        </div>
        <div className="prog-track">
          <div
            className={`prog-fill ${progressFillClass}`}
            style={{ width: `${detail.completion.percent}%` }}
          />
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            margin: '0 14px 8px',
            background: '#FFF0EB',
            border: '1px solid #F29C85',
            color: '#A5351E',
            borderRadius: '12px',
            padding: '7px 11px',
            fontSize: '0.73rem',
            fontWeight: 700,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Variable Polaroid Collage Mat */}
      <div
        className="card-ivory"
        style={{
          flex: 1,
          margin: '0 14px',
          borderRadius: '28px',
          padding: '9px',
          display: 'grid',
          gap: '8px',
          minHeight: 0,
          ...gridLayoutStyle,
        }}
      >
        {detail.members.map((member, idx) => {
          const checkin = checkinByMember.get(member.id);
          const spanTwo = detail.layoutMode === 'split-3' && idx === 0;
          const tileWrapperStyle: React.CSSProperties = {
            gridColumn: spanTwo ? 'span 2' : undefined,
            minHeight: 0,
          };

          if (checkin && checkin.status === 'photo') {
            return (
              <div
                key={member.id}
                style={{
                  ...tileWrapperStyle,
                  position: 'relative',
                  borderRadius: '19px',
                  overflow: 'hidden',
                  background: 'linear-gradient(145deg, #F4DFCE, #E7C9B4)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {checkin.imageData && (
                  <img
                    src={checkin.imageData}
                    alt={`${member.nickname}의 인증 사진`}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to bottom, rgba(40,31,26,0.14) 0%, transparent 35%, rgba(40,31,26,0.34) 100%)',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'relative',
                    zIndex: 3,
                    padding: '8px 8px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      background: 'rgba(255, 253, 249, 0.9)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      color: 'var(--ink-primary)',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: '999px',
                    }}
                  >
                    {member.isCurrentUser ? '나' : member.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleLike(checkin.id)}
                    aria-label={`${member.nickname} 인증 좋아요`}
                    style={{
                      background: checkin.likedByMe
                        ? 'var(--accent-coral)'
                        : 'rgba(255, 253, 249, 0.9)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      border: 'none',
                      color: checkin.likedByMe ? '#fff' : 'var(--ink-primary)',
                      fontSize: '0.67rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    <HeartIcon size={11} filled={checkin.likedByMe} />
                    <span>{checkin.likesCount}</span>
                  </button>
                </div>

                <div
                  style={{
                    position: 'relative',
                    zIndex: 3,
                    margin: '7px',
                    background: 'rgba(255, 253, 249, 0.92)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderRadius: '13px',
                    padding: '6px 9px',
                    boxShadow: '0 4px 12px rgba(40, 31, 26, 0.12)',
                  }}
                >
                  <div
                    className="serif-num"
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: 'var(--accent-coral)',
                      lineHeight: 1.2,
                    }}
                  >
                    {checkin.timestampLabel}
                  </div>
                  <div
                    style={{
                      fontSize: '0.69rem',
                      fontWeight: 600,
                      color: 'var(--ink-primary)',
                      lineHeight: 1.32,
                      marginTop: '1px',
                    }}
                  >
                    {checkin.note}
                  </div>
                </div>
              </div>
            );
          }

          if (checkin && checkin.status === 'rest') {
            return (
              <div
                key={member.id}
                style={{
                  ...tileWrapperStyle,
                  borderRadius: '19px',
                  border: '1.5px solid #EBD6A2',
                  background: 'linear-gradient(155deg, #FFFDF5 0%, #FFF4D9 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '12px 10px',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#FFE8B3',
                    color: '#9A640E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CloudIcon size={18} />
                </div>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#6B4911' }}>
                  {member.isCurrentUser ? '오늘은 쉬어가는 날' : `${member.nickname} 님 휴식`}
                </div>
                <div style={{ fontSize: '0.64rem', color: '#8F6929', lineHeight: 1.3 }}>
                  휴식 스티커로 연속 흐름 유지 중
                </div>
              </div>
            );
          }

          // Empty slot for me today -> interactive camera card
          if (member.isCurrentUser && isToday) {
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setCameraOpen(true)}
                style={{
                  ...tileWrapperStyle,
                  borderRadius: '19px',
                  border: '2px dashed #EE9B88',
                  background: 'linear-gradient(155deg, #FFFDF7 0%, #FFF1E8 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '12px 10px',
                  gap: '7px',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #F58168, #EE6348)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 7px 16px rgba(238, 99, 72, 0.34)',
                  }}
                >
                  <CameraIcon size={20} />
                </div>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--ink-primary)' }}>
                  오늘 나의 순간 남기기
                </div>
                <div style={{ fontSize: '0.66rem', fontWeight: 600, color: 'var(--accent-coral)' }}>
                  5분만 한 것도 충분히 멋져요!
                </div>
              </button>
            );
          }

          return (
            <div
              key={member.id}
              style={{
                ...tileWrapperStyle,
                borderRadius: '19px',
                border: '1.5px dashed var(--border-soft)',
                background: 'var(--phone-bg)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '10px',
                gap: '4px',
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>
                {member.isCurrentUser ? '이날은 비어 있어요' : `${member.nickname} 님 기다리는 중`}
              </div>
              <div style={{ fontSize: '0.64rem', color: 'var(--ink-muted)' }}>
                {isToday ? '곧 도착할 거예요' : '기록 없음'}
              </div>
            </div>
          );
        })}
      </div>

      {/* 1-person solo room inspiration strip */}
      {detail.members.length <= 1 && detail.sameTagInspiration.length > 0 && (
        <div style={{ margin: '10px 14px 0' }}>
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'var(--ink-secondary)',
              marginBottom: '6px',
            }}
          >
            비슷한 관심사 메이트들의 최근 순간
          </div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {detail.sameTagInspiration.map(item => (
              <div
                key={item.id}
                style={{
                  minWidth: '150px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: '14px',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                }}
              >
                <img
                  src={item.imageData}
                  alt={item.nickname}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '9px',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--accent-coral)' }}>
                    {item.tag} · {item.nickname}
                  </div>
                  <div
                    style={{
                      fontSize: '0.63rem',
                      color: 'var(--ink-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Cozy Action Bar */}
      <footer
        style={{
          padding: '12px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            fontSize: '0.69rem',
            color: 'var(--ink-secondary)',
            lineHeight: 1.38,
            fontWeight: 500,
          }}
        >
          {detail.myStatusOnSelectedDate === 'photo'
            ? '오늘의 내 조각을 남겼어요! 내 앨범에도 저장됐어요'
            : detail.myStatusOnSelectedDate === 'rest'
              ? '오늘은 가볍게 숨을 고르고 내일 다시 만나요'
              : '내 사진이 올라오면 오늘의 합동 포스터가 완성돼요'}
        </div>

        {isToday && detail.myStatusOnSelectedDate === 'pending' && (
          <button
            type="button"
            disabled={submitting || detail.restPassesLeftThisWeek === 0}
            onClick={handleRestPass}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              color:
                detail.restPassesLeftThisWeek === 0
                  ? 'var(--ink-muted)'
                  : 'var(--ink-secondary)',
              fontFamily: 'inherit',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '7px 12px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              cursor:
                detail.restPassesLeftThisWeek === 0 ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 3px 8px rgba(68, 48, 34, 0.05)',
            }}
          >
            <CloudIcon size={13} />
            <span>
              {detail.restPassesLeftThisWeek > 0
                ? '오늘은 쉬어가기'
                : '이번 주 휴식권 사용됨'}
            </span>
          </button>
        )}
      </footer>

      {/* Past Dates History Drawer */}
      {calendarOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="날짜별 합동 보드 기록"
          onClick={e => {
            if (e.target === e.currentTarget) setCalendarOpen(false);
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
          <div
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
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '0.94rem', fontWeight: 800 }}>
                날짜별 합동 보드 기록
              </h3>
              <button
                type="button"
                onClick={() => setCalendarOpen(false)}
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {detail.availableDates.map(d => {
                const active = d === detail.selectedDate;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleSelectDate(d)}
                    className="serif-num"
                    style={{
                      border: active
                        ? '1.5px solid var(--accent-coral)'
                        : '1px solid var(--border-soft)',
                      background: active
                        ? 'var(--accent-coral-soft)'
                        : 'var(--phone-bg)',
                      color: active ? 'var(--accent-coral)' : 'var(--ink-primary)',
                      padding: '8px 13px',
                      borderRadius: '12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {d === detail.today ? `${d} (오늘)` : d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Live Camera Modal */}
      <LiveCameraModal
        open={cameraOpen}
        roomTitle={detail.room.title}
        tag={detail.room.tag}
        submitting={submitting}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
      />
    </div>
  );
}

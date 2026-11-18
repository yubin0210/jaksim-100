'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import {
  CalendarIcon,
  CameraIcon,
  ChevronLeftIcon,
  CloudIcon,
  FlameIcon,
  HeartIcon,
} from '@/components/Icons';
import { JournalDialog } from './JournalDialog';
import { LiveCameraModal } from '@/components/LiveCameraModal';
import {
  buildRoomBoardSlots,
  resolveRoomBoardFooterState,
} from '@/lib/ui-guards';
import type { DailyCheckin, RoomDetailResponse } from '@/types/ongi';

export function RoomBoardClient({
  initialDetail,
}: {
  initialDetail: RoomDetailResponse;
}) {
  const [detail, setDetail] = useState<RoomDetailResponse>(initialDetail);
  const [cameraOpen, setCameraOpen] = useState(false);
  const dateRequest = useRef(0);
  const [restOpen, setRestOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isToday = detail.selectedDate === detail.today;
  const slots = buildRoomBoardSlots({
    members: detail.members,
    checkins: detail.checkins,
    isToday,
  });
  const footerState = resolveRoomBoardFooterState({
    isJoined: detail.isJoined,
    memberCount: detail.members.length,
    maxCapacity: detail.room.maxCapacity,
    myStatusOnSelectedDate: detail.myStatusOnSelectedDate,
    restPassesLeftThisWeek: detail.restPassesLeftThisWeek,
    isToday,
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  const handleJoinFromPreview = async () => {
    if (joining) return;
    setJoining(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/rooms/${detail.room.id}/join`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || '방 참여에 실패했어요.');
        return;
      }
      setDetail(json.room as RoomDetailResponse);
      showToast('방에 함께하게 되었어요!');
    } catch {
      setErrorMsg('연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setJoining(false);
    }
  };

  const handleSelectDate = async (dateStr: string) => {
    setCalendarOpen(false);
    setErrorMsg(null);
    const request = ++dateRequest.current;
    try {
      const res = await fetch(
        `/api/rooms/${detail.room.id}?date=${encodeURIComponent(dateStr)}`
      );
      if (!res.ok) throw new Error();
      const data: RoomDetailResponse = await res.json();
      if (request === dateRequest.current) setDetail(data);
    } catch {
      if (request === dateRequest.current)
        setErrorMsg('선택한 날짜의 기록을 불러오지 못했어요.');
    }
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
        showToast('오늘의 인증 사진을 방에 올렸어요.');
      }
    } catch {
      setErrorMsg('연결을 확인하고 다시 시도해 주세요.');
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
      setRestOpen(false);
      showToast('오늘 휴식 스티커를 붙였어요');
    } catch {
      setErrorMsg('연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const [pendingLikes, setPendingLikes] = useState(new Map<string, boolean>());
  const pending =
    submitting || joining || pendingLikes.size > 0 || calendarOpen || cameraOpen || restOpen;
  useEffect(() => {
    if (pending) return;
    const controller = new AbortController();
    let fetching = false;
    async function refresh() {
      if (document.hidden || fetching) return;
      fetching = true;
      const version = dateRequest.current;
      try {
        const suffix = isToday ? '' : '?date=' + detail.selectedDate;
        const res = await fetch('/api/rooms/' + detail.room.id + suffix, {
          signal: controller.signal,
        });
        if (res.ok) {
          const next: RoomDetailResponse = await res.json();
          if (!controller.signal.aborted && version === dateRequest.current)
            setDetail(next);
        }
      } catch {
        // Keep the displayed board when a background refresh is interrupted.
      } finally {
        fetching = false;
      }
    }
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, [pending, isToday, detail.room.id, detail.selectedDate]);

  async function handleToggleLike(record: DailyCheckin) {
    if (pendingLikes.has(record.id)) return;
    setPendingLikes((prev) => new Map(prev).set(record.id, !record.likedByMe));
    setErrorMsg(null);
    try {
      const res = await fetch('/api/checkins/' + record.id + '/like', {
        method: 'POST',
      });
      if (!res.ok) throw new Error();
      const { checkin }: { checkin: DailyCheckin } = await res.json();
      setDetail((prev) => ({
        ...prev,
        checkins: prev.checkins.map((c) => (c.id === checkin.id ? checkin : c)),
      }));
    } catch {
      setErrorMsg('좋아요를 저장하지 못했어요. 다시 눌러 주세요.');
    } finally {
      setPendingLikes((prev) => {
        const next = new Map(prev);
        next.delete(record.id);
        return next;
      });
    }
  }

  const visibleSlots = isToday ? slots : slots.filter((slot) => slot.checkin);
  return (
    <main className="board-page">
      <div className="board-nav">
        <Link href={initialDetail.isJoined ? '/' : '/explore'}>
          <ChevronLeftIcon />
          {initialDetail.isJoined ? '내 방' : '방 탐색'}
        </Link>
        <button className="secondary" onClick={() => setCalendarOpen(true)}>
          <CalendarIcon />
          날짜별 기록
        </button>
      </div>
      <header className="board-heading">
        <p className="kicker">
          {detail.room.tag} · {detail.members.length}/{detail.room.maxCapacity}
          명
        </p>
        <h1>{detail.room.title}</h1>
        <p>
          <FlameIcon />
          함께 기록한 연속 {detail.room.streakDays}일
        </p>
      </header>
      <section className="board-summary">
        <div>
          <h2>{isToday ? '오늘의 보드' : detail.selectedDate + '의 보드'}</h2>
          <p>
            {isToday
              ? detail.completion.completedCount +
                ' / ' +
                detail.completion.totalCount +
                '명 기록'
              : '남겨진 기록 ' + visibleSlots.length + '개'}
          </p>
        </div>
        {isToday && (
          <progress
            aria-label="오늘 방 달성률"
            max={100}
            value={detail.completion.percent}
          />
        )}
      </section>
      {toastMsg && (
        <p className="notice" role="status">
          {toastMsg}
        </p>
      )}
      {errorMsg && !cameraOpen && !restOpen && (
        <p className="error" role="alert">
          {errorMsg}
        </p>
      )}
      <section
        className={'board-grid slots-' + visibleSlots.length}
        aria-label="방 멤버들의 기록"
      >
        {visibleSlots.map((slot) => {
          const record = slot.checkin;
          if (record?.status === 'photo') {
            const liked = pendingLikes.get(record.id) ?? record.likedByMe;
            const count = record.likesCount + Number(liked) - Number(record.likedByMe);
            return (
              <article className="board-print" key={slot.key}>
                {record.imageData && (
                  <img
                    src={record.imageData}
                    alt={slot.nickname + '의 인증 사진'}
                  />
                )}
                <div>
                  <small>
                    {slot.nickname} · {record.timestampLabel}
                  </small>
                  <p>{record.note}</p>
                  <button
                    className="like"
                    aria-label={slot.nickname + ' 기록 좋아요'}
                    aria-pressed={liked}
                    aria-disabled={pendingLikes.has(record.id)}
                    onClick={() => handleToggleLike(record)}
                  >
                    <HeartIcon size={18} filled={liked} aria-hidden="true" />
                    {count}
                  </button>
                </div>
              </article>
            );
          }
          if (record)
            return (
              <article key={slot.key} className="board-tile rest">
                <CloudIcon size={32} />
                <strong>{slot.nickname}님의 휴식</strong>
                <small>오늘은 쉬어가는 날</small>
              </article>
            );
          if (slot.isCurrentUser && isToday)
            return (
              <button
                key={slot.key}
                className="board-tile capture"
                onClick={() => {
                  setErrorMsg(null);
                  setCameraOpen(true);
                }}
              >
                <CameraIcon size={32} />
                <strong>오늘의 사진 남기기</strong>
              </button>
            );
          return (
            <article key={slot.key} className="board-tile">
              <span className="initial">{slot.avatarInitial}</span>
              <strong>{slot.nickname}님의 자리</strong>
            </article>
          );
        })}
      </section>
      <footer className="board-footer">
        {footerState === 'joinable-preview' && (
          <>
            <p>
              하루 한 장, 주 1회는 쉬어갈 수 있어요. 3일 연속 기록이 없으면
              멤버가 자동 정리될 수 있어요.
            </p>
            <button
              className="primary"
              disabled={joining}
              onClick={handleJoinFromPreview}
            >
              {joining ? '참여 중…' : '함께하기'}
            </button>
          </>
        )}
        {footerState === 'full-preview' && <p>지금은 자리가 모두 찼어요.</p>}
        {footerState.startsWith('member-pending') && (
          <>
            <p>오늘은 잠시 쉬어가도 괜찮아요.</p>
            <button
              className="secondary"
              disabled={
                footerState === 'member-pending-rest-used' || submitting
              }
              onClick={() => {
                setErrorMsg(null);
                setRestOpen(true);
              }}
            >
              <CloudIcon />
              {footerState === 'member-pending-rest-used'
                ? '이번 주 휴식권 사용됨'
                : '휴식권 사용하기'}
            </button>
          </>
        )}
        {footerState === 'member-photo-done' && (
          <Link href="/album">오늘 사진을 내 앨범에서 보기 →</Link>
        )}
        {footerState === 'member-rest-done' && (
          <p>오늘은 휴식 스티커를 붙였어요.</p>
        )}
        {!isToday && (
          <button
            className="secondary"
            onClick={() => handleSelectDate(detail.today)}
          >
            오늘로 돌아가기
          </button>
        )}
      </footer>
      {isToday && detail.sameTagInspiration.length > 0 && (
        <section>
          <div className="section-heading">
            <h2>다른 방의 최근 기록</h2>
          </div>
          <div className="inspiration">
            {detail.sameTagInspiration.map((item) => (
              <figure key={item.id}>
                <img
                  src={item.imageData}
                  alt={item.nickname + '의 인증 사진'}
                />
                <figcaption>
                  {item.roomTitle} · {item.nickname}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      {calendarOpen && (
        <JournalDialog
          title="날짜별 보드 기록"
          onClose={() => setCalendarOpen(false)}
        >
          <div className="chips">
            {detail.availableDates.map((date) => (
              <button
                key={date}
                aria-pressed={date === detail.selectedDate}
                onClick={() => handleSelectDate(date)}
              >
                {date}
                {date === detail.today ? ' · 오늘' : ''}
              </button>
            ))}
          </div>
        </JournalDialog>
      )}
      {restOpen && (
        <JournalDialog
          title="오늘은 쉬어갈까요?"
          busy={submitting}
          onClose={() => setRestOpen(false)}
        >
          <p>
            이번 주 이 방의 휴식권 1회를 사용해요. 오늘은 사진 대신 휴식
            스티커를 남기고 연속 기록을 이어가요.
          </p>
          {errorMsg && (
            <p className="error" role="alert">
              {errorMsg}
            </p>
          )}
          <div className="action-row">
            <button
              className="secondary"
              disabled={submitting}
              onClick={() => setRestOpen(false)}
            >
              취소
            </button>
            <button
              className="primary"
              disabled={submitting}
              onClick={handleRestPass}
            >
              {submitting ? '사용 중…' : '휴식권 사용'}
            </button>
          </div>
        </JournalDialog>
      )}
      {cameraOpen && (
        <LiveCameraModal
          roomTitle={detail.room.title}
          tag={detail.room.tag}
          submitting={submitting}
          error={errorMsg}
          onClose={() => {
            setErrorMsg(null);
            setCameraOpen(false);
          }}
          onCapture={handleCapture}
        />
      )}
    </main>
  );
}

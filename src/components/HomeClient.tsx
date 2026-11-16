'use client';

import Link from 'next/link';
import { BottomNav } from '@/components/BottomNav';
import {
  CameraIcon,
  CheckIcon,
  CloudIcon,
  FlameIcon,
  SproutIcon,
  SunIcon,
} from '@/components/Icons';
import { MiniPolaroid } from '@/components/MiniPolaroid';
import type { RoomSummary, WeekRhythmDay } from '@/types/ongi';

interface HomeClientProps {
  initialMyRooms: RoomSummary[];
  weekRhythm: WeekRhythmDay[];
}

export function HomeClient({ initialMyRooms, weekRhythm }: HomeClientProps) {
  return (
    <>
      <div className="screen-scroll">
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
                fontSize: '0.74rem',
                fontWeight: 600,
                color: 'var(--ink-secondary)',
                marginBottom: '3px',
              }}
            >
              <SunIcon size={13} style={{ color: 'var(--accent-coral)' }} />
              <span>오늘도 수고한 하루</span>
            </div>
            <h1
              style={{
                fontSize: '1.22rem',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.32,
                color: 'var(--ink-primary)',
              }}
            >
              오늘의 작은 한 걸음,
              <br />
              사진으로 남겨볼까요?
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
            함께하는 방{' '}
            <strong
              className="serif-num"
              style={{ color: 'var(--accent-coral)', fontSize: '0.84rem' }}
            >
              {initialMyRooms.length}
            </strong>
          </div>
        </header>

        {/* Weekly Rhythm Strip */}
        <section
          aria-label="이번 주 내 인증 흐름"
          className="card-ivory"
          style={{
            borderRadius: '18px',
            padding: '10px 13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--ink-secondary)',
            }}
          >
            이번 주 흐름
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {weekRhythm.map(day => (
              <div
                key={day.date}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: day.isToday ? 'var(--accent-coral)' : 'var(--ink-muted)',
                }}
              >
                <span>{day.label}</span>
                <span
                  style={{
                    width: '17px',
                    height: '17px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: day.done
                      ? 'var(--accent-sage)'
                      : day.isToday
                        ? 'var(--accent-coral-soft)'
                        : 'var(--surface-tint)',
                    color: day.done ? '#fff' : 'var(--accent-coral)',
                    border:
                      !day.done && day.isToday
                        ? '1.5px dashed var(--accent-coral)'
                        : 'none',
                  }}
                >
                  {day.done ? <CheckIcon size={10} /> : null}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Joined Rooms Stack */}
        {initialMyRooms.length === 0 ? (
          <div
            className="card-ivory"
            style={{
              padding: '28px 18px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'var(--accent-sage-soft)',
                color: 'var(--accent-sage)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SproutIcon size={22} />
            </div>
            <p style={{ fontSize: '0.88rem', fontWeight: 700 }}>
              아직 참여 중인 자기계발 방이 없어요
            </p>
            <p style={{ fontSize: '0.76rem', color: 'var(--ink-secondary)' }}>
              관심 있는 주제의 소규모 방에 들어가 오늘의 조각을 남겨보세요.
            </p>
            <Link
              href="/explore"
              style={{
                marginTop: '4px',
                background: 'var(--accent-coral)',
                color: '#fff',
                textDecoration: 'none',
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '9px 16px',
                borderRadius: '999px',
              }}
            >
              다정한 방 찾아보기
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
            {initialMyRooms.map((room, idx) => {
              const isPending = room.myStatusToday === 'pending';
              const isDone = room.myStatusToday === 'photo';
              const fillClass =
                room.completionPercent === 100
                  ? 'fill-sage'
                  : room.completionPercent < 50
                    ? 'fill-honey'
                    : 'fill-coral';

              return (
                <Link
                  key={room.id}
                  href={`/rooms/${room.id}`}
                  className="card-ivory animate-fade-up"
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    padding: '13px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    animationDelay: `${idx * 0.05}s`,
                    borderColor: isPending ? '#F0C0AF' : 'var(--border-soft)',
                    background: isPending
                      ? 'linear-gradient(165deg, #FFFDF9 0%, #FFF6F0 100%)'
                      : 'var(--surface)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: 'var(--ink-secondary)',
                          }}
                        >
                          {room.tag}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: 'var(--accent-honey-soft)',
                            color: '#9A640E',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                          }}
                        >
                          <FlameIcon size={11} />
                          <span className="serif-num">Day {room.streakDays}</span>
                        </span>
                      </div>
                      <h2
                        style={{
                          fontSize: '0.96rem',
                          fontWeight: 800,
                          letterSpacing: '-0.02em',
                          color: 'var(--ink-primary)',
                          marginBottom: '7px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {room.title}
                      </h2>

                      {isPending && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: 'var(--accent-coral)',
                            color: '#fff',
                            fontSize: '0.69rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '999px',
                            boxShadow: '0 3px 9px rgba(238, 99, 72, 0.24)',
                          }}
                        >
                          <CameraIcon size={12} />
                          <span>오늘 나의 순간 남기기</span>
                        </span>
                      )}

                      {isDone && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: 'var(--accent-sage-soft)',
                            color: '#39724B',
                            fontSize: '0.69rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '999px',
                          }}
                        >
                          <CheckIcon size={12} />
                          <span>오늘 인증 완료</span>
                        </span>
                      )}

                      {room.myStatusToday === 'rest' && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: 'var(--accent-honey-soft)',
                            color: '#8E5F12',
                            fontSize: '0.69rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '999px',
                          }}
                        >
                          <CloudIcon size={12} />
                          <span>오늘 휴식권 사용</span>
                        </span>
                      )}
                    </div>

                    <MiniPolaroid tiles={room.previewTiles} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        fontSize: '0.69rem',
                        color: 'var(--ink-secondary)',
                      }}
                    >
                      <span>
                        {room.completionPercent === 100
                          ? `모두 도착했어요! (${room.completedCount}/${room.memberCount}명)`
                          : `오늘 ${room.completedCount}/${room.memberCount}명이 온기를 채웠어요`}
                      </span>
                      <span
                        className="serif-num"
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          color:
                            room.completionPercent === 100
                              ? 'var(--accent-sage)'
                              : 'var(--ink-primary)',
                        }}
                      >
                        {room.completionPercent}%
                      </span>
                    </div>
                    <div className="prog-track">
                      <div
                        className={`prog-fill ${fillClass}`}
                        style={{ width: `${room.completionPercent}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav active="home" />
    </>
  );
}

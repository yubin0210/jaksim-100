'use client';

import { useRef, useState } from 'react';
import { BottomNav } from './BottomNav';
import { JournalDialog } from './JournalDialog';
import { CloudIcon, HeartIcon } from './Icons';
import type { AlbumEntry, AlbumResponse } from '@/types/ongi';

function monthLabel(value: string) {
  const [year, month] = value.split('-');
  return year + '년 ' + Number(month) + '월';
}

export function AlbumClient({ initialAlbum }: { initialAlbum: AlbumResponse }) {
  const [album, setAlbum] = useState(initialAlbum);
  const [roomId, setRoomId] = useState('');
  const [desired, setDesired] = useState({
    month: initialAlbum.month,
    room: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<AlbumEntry[]>([]);
  const sequence = useRef(0);

  async function select(month: string, room: string) {
    const current = ++sequence.current;
    setDesired({ month, room });
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        '/api/album?' + new URLSearchParams({ month, roomId: room })
      );
      if (!res.ok) throw new Error();
      const data: AlbumResponse = await res.json();
      if (current !== sequence.current) return;
      setAlbum(data);
      setRoomId(room);
    } catch {
      if (current !== sequence.current) return;
      setDesired({ month: album.month, room: roomId });
      setError('기록을 불러오지 못했어요. 이전 선택으로 돌아왔어요.');
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }

  const [year, month] = album.month.split('-').map(Number);
  const days = new Date(year, month, 0).getDate();
  const offset = new Date(year, month - 1, 1).getDay();
  const byDate = new Map<string, AlbumEntry[]>();
  for (const entry of album.entries) {
    const group = byDate.get(entry.checkinDate) ?? [];
    group.push(entry);
    byDate.set(entry.checkinDate, group);
  }

  return (
    <div className="app-page">
      <main className="journal-content">
        <header className="page-title">
          <div>
            <h1>내 앨범</h1>
            <p>사진을 남긴 날도, 잠시 쉬어간 날도.</p>
          </div>
        </header>
        <div className="album-filters">
          <label>
            월
            <select
              value={desired.month}
              onChange={(e) => select(e.target.value, desired.room)}
            >
              {album.availableMonths.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label>
            방
            <select
              value={desired.room}
              onChange={(e) => select(desired.month, e.target.value)}
            >
              <option value="">전체 방</option>
              {album.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status" className="notice">
            선택한 기록을 불러오는 중…
          </p>
        ) : (
          <div className="album-layout">
            <section className="calendar">
              <h2>{monthLabel(album.month)}</h2>
              <div className="calendar-grid">
                {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                  <small key={d}>{d}</small>
                ))}
                {Array.from({ length: offset }, (_, i) => (
                  <i key={'pad' + i} />
                ))}
                {Array.from({ length: days }, (_, i) => {
                  const day = i + 1;
                  const date = album.month + '-' + String(day).padStart(2, '0');
                  const entries = byDate.get(date);
                  if (!entries)
                    return (
                      <span className="calendar-day" key={date}>
                        {day}
                      </span>
                    );
                  const photo = entries.find(
                    (e) => e.status === 'photo' && e.imageData
                  );
                  return (
                    <button
                      className="calendar-day marked"
                      key={date}
                      aria-label={date + ' 기록 ' + entries.length + '개 보기'}
                      onClick={() => setDetail(entries)}
                    >
                      {photo?.imageData ? (
                        <img src={photo.imageData} alt="" />
                      ) : (
                        <CloudIcon />
                      )}
                      <b>{day}</b>
                      {entries.length > 1 && (
                        <small>+{entries.length - 1}</small>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
            <section>
              <div className="section-heading">
                <h2>
                  이달의 기록 <small>{album.entries.length}</small>
                </h2>
              </div>
              {!album.entries.length && (
                <div className="empty-paper">
                  <h3>아직 기록이 없어요.</h3>
                  <p>선택한 달과 방의 사진이 여기에 모여요.</p>
                </div>
              )}
              <div className="entries">
                {album.entries.map((entry) => (
                  <button
                    key={entry.id}
                    className="entry"
                    onClick={() => setDetail([entry])}
                  >
                    {entry.imageData ? (
                      <img src={entry.imageData} loading="lazy" alt="" />
                    ) : (
                      <CloudIcon size={27} />
                    )}
                    <span>
                      <small>
                        {entry.checkinDate} · {entry.roomTitle}
                      </small>
                      <strong>{entry.note}</strong>
                    </span>
                    <small>
                      <HeartIcon />
                      {entry.likesCount}
                    </small>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
      <BottomNav active="album" />
      {detail.length > 0 && (
        <JournalDialog
          title={detail[0].checkinDate + '의 기록'}
          onClose={() => setDetail([])}
        >
          {detail.map((entry) => (
            <article className="album-print" key={entry.id}>
              {entry.imageData ? (
                <img
                  src={entry.imageData}
                  alt={entry.roomTitle + ' 인증 사진'}
                />
              ) : (
                <div className="rest-print">
                  <CloudIcon size={42} />
                  쉬어간 날
                </div>
              )}
              <p className="kicker">
                {entry.tag} · {entry.timestampLabel}
              </p>
              <h3>{entry.roomTitle}</h3>
              <p>{entry.note}</p>
              <small>좋아요 {entry.likesCount}개</small>
            </article>
          ))}
        </JournalDialog>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { JournalDialog } from './JournalDialog';
import { CameraIcon } from './Icons';
import {
  captureFromStreamWithStamp,
  formatKstClock,
  paintWarmAmbientPreview,
} from '@/lib/camera-adapter';
import { isCameraShutterAllowed } from '@/lib/ui-guards';

type Photo = { imageData: string; timestampLabel: string };
const allowFallback = process.env.NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK === 'true';

export function LiveCameraModal({
  roomTitle,
  tag,
  submitting,
  error,
  onClose,
  onCapture,
}: {
  roomTitle: string;
  tag: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onCapture: (payload: Photo & { note: string }) => Promise<void>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const fallback = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'loading' | 'live' | 'fallback'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [note, setNote] = useState('');
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    if (photo) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    const stop = () => stream?.getTracks().forEach((track) => track.stop());
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled || !video.current) {
          stop();
          return;
        }
        video.current.srcObject = stream;
        await video.current.play();
        if (!cancelled && video.current.readyState >= 2) setMode('live');
      } catch {
        stop();
        if (!cancelled) {
          setMode('fallback');
          if (allowFallback && fallback.current)
            paintWarmAmbientPreview(fallback.current, 0.6, tag);
        }
      }
    }
    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [photo, attempt, tag]);

  function restart() {
    setMode('loading');
    setCameraError('');
    setPhoto(null);
    setAttempt((n) => n + 1);
  }

  function shoot() {
    const timestampLabel = formatKstClock();
    const imageData = captureFromStreamWithStamp(
      mode === 'live' ? video.current : null,
      { roomTitle, tag, timestampLabel },
      mode === 'fallback' && allowFallback ? fallback.current : null
    );
    if (!imageData) {
      setCameraError('카메라 영상을 읽지 못했어요. 다시 연결해 주세요.');
      return;
    }
    setPhoto({ imageData, timestampLabel });
  }

  return (
    <JournalDialog
      title={photo ? '이 사진을 남길까요?' : '오늘의 사진 찍기'}
      onClose={onClose}
      busy={submitting}
    >
      <p className="hint">
        {roomTitle} · {tag}
      </p>
      <div className="viewfinder">
        {photo ? (
          <img src={photo.imageData} alt="게시할 사진 미리보기" />
        ) : (
          <>
            <video
              ref={video}
              playsInline
              muted
              onPlaying={() => {
                if (video.current?.videoWidth) setMode('live');
              }}
            />
            {allowFallback && (
              <canvas
                hidden={mode !== 'fallback'}
                ref={fallback}
                width={600}
                height={760}
              />
            )}
            {mode === 'loading' && <span role="status">카메라 연결 중…</span>}
            {mode === 'fallback' && !allowFallback && (
              <span>
                카메라에 연결할 수 없어요.
                <br />
                기기와 브라우저의 카메라 권한을 확인해 주세요.
              </span>
            )}
          </>
        )}
      </div>
      {photo ? (
        <div className="stack">
          <label>
            짧은 한마디 <small>(선택)</small>
            <input
              maxLength={40}
              disabled={submitting}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="오늘 어떤 걸 해봤나요?"
            />
          </label>
          <p className="hint">
            사진과 한마디는 로그인한 메이트들이 방 미리보기와 다른 방의 최근
            기록에서도 볼 수 있어요.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="action-row">
            <button
              className="secondary"
              disabled={submitting}
              onClick={restart}
            >
              다시 찍기
            </button>
            <button
              className="primary"
              disabled={submitting}
              onClick={() => onCapture({ ...photo, note: note.trim() })}
            >
              {submitting ? '사진 올리는 중…' : '보드에 올리기'}
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          {cameraError && (
            <p className="error" role="alert">
              {cameraError}
            </p>
          )}
          {(cameraError || mode === 'fallback') && (
            <button className="secondary" onClick={restart}>
              카메라 다시 연결
            </button>
          )}
          <button
            className="primary"
            disabled={
              !isCameraShutterAllowed({ cameraMode: mode, allowFallback })
            }
            onClick={shoot}
          >
            <CameraIcon />
            사진 찍기
          </button>
        </div>
      )}
    </JournalDialog>
  );
}

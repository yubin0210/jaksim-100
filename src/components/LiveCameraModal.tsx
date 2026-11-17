'use client';

import { useEffect, useRef, useState } from 'react';
import { CameraIcon, RefreshIcon } from '@/components/Icons';
import {
  captureFromStreamWithStamp,
  formatKstClock,
  paintWarmAmbientPreview,
} from '@/lib/camera-adapter';
import { isCameraShutterAllowed } from '@/lib/ui-guards';

interface LiveCameraModalProps {
  open: boolean;
  roomTitle: string;
  tag: string;
  submitting: boolean;
  onClose: () => void;
  onCapture: (payload: { imageData: string; note: string; timestampLabel: string }) => Promise<void>;
}

const ALLOW_CAMERA_FALLBACK =
  process.env.NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK === 'true';

export function LiveCameraModal({
  open,
  roomTitle,
  tag,
  submitting,
  onClose,
  onCapture,
}: LiveCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraMode, setCameraMode] = useState<'loading' | 'live' | 'fallback'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [note, setNote] = useState('');
  const [clock, setClock] = useState(() => formatKstClock());

  const shutterAllowed = isCameraShutterAllowed({
    cameraMode,
    allowFallback: ALLOW_CAMERA_FALLBACK,
  });

  useEffect(() => {
    if (!open) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      return;
    }

    setNote('');
    setClock(formatKstClock());
    const clockTimer = setInterval(() => setClock(formatKstClock()), 15000);

    let cancelled = false;

    async function initCamera() {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        if (!cancelled) setCameraMode('fallback');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraMode('live');
      } catch {
        if (!cancelled) setCameraMode('fallback');
      }
    }

    setCameraMode('loading');
    initCamera();

    return () => {
      cancelled = true;
      clearInterval(clockTimer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [open, retryCount]);

  useEffect(() => {
    if (!open || cameraMode !== 'fallback' || !ALLOW_CAMERA_FALLBACK) return;
    let rafId = 0;
    let phase = 0;

    const renderLoop = () => {
      const canvas = previewCanvasRef.current;
      if (canvas) {
        phase += 0.02;
        paintWarmAmbientPreview(canvas, phase, tag);
      }
      rafId = requestAnimationFrame(renderLoop);
    };
    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [open, cameraMode, tag]);

  if (!open) return null;

  const handleShutter = async () => {
    if (submitting || !shutterAllowed) return;
    const timestampLabel = formatKstClock();
    const imageData = captureFromStreamWithStamp(
      cameraMode === 'live' ? videoRef.current : null,
      { roomTitle, tag, timestampLabel },
      cameraMode === 'fallback' && ALLOW_CAMERA_FALLBACK
        ? previewCanvasRef.current
        : null
    );
    await onCapture({
      imageData,
      note: note.trim(),
      timestampLabel,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="실시간 인증 카메라"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        background: '#231B16',
        color: '#FAF6F0',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 16px 20px',
        gap: '11px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.78rem',
          fontWeight: 700,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          style={{
            background: 'rgba(255, 253, 249, 0.14)',
            border: 'none',
            color: '#FAF6F0',
            padding: '6px 12px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          닫기
        </button>
        <span>{tag} 실시간 인증</span>
        <span
          style={{
            background: 'rgba(238, 99, 72, 0.24)',
            border: '1px solid rgba(238, 99, 72, 0.5)',
            color: '#FFAE9D',
            fontSize: '0.64rem',
            padding: '3px 9px',
            borderRadius: '999px',
          }}
        >
          갤러리 불가
        </span>
      </div>

      <div
        style={{
          flex: 1,
          borderRadius: '24px',
          position: 'relative',
          overflow: 'hidden',
          border: '1.5px solid rgba(255, 253, 249, 0.2)',
          background: '#332924',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '14px',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: cameraMode === 'live' ? 'block' : 'none',
          }}
        />
        {ALLOW_CAMERA_FALLBACK && (
          <canvas
            ref={previewCanvasRef}
            width={600}
            height={760}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: cameraMode === 'fallback' ? 'block' : 'none',
            }}
          />
        )}

        {/* Corner focus brackets */}
        <span style={{ position: 'absolute', top: 12, left: 12, width: 18, height: 18, borderTop: '2px solid rgba(255,253,249,0.78)', borderLeft: '2px solid rgba(255,253,249,0.78)', borderRadius: '4px 0 0 0', zIndex: 3 }} />
        <span style={{ position: 'absolute', top: 12, right: 12, width: 18, height: 18, borderTop: '2px solid rgba(255,253,249,0.78)', borderRight: '2px solid rgba(255,253,249,0.78)', borderRadius: '0 4px 0 0', zIndex: 3 }} />
        <span style={{ position: 'absolute', bottom: 12, left: 12, width: 18, height: 18, borderBottom: '2px solid rgba(255,253,249,0.78)', borderLeft: '2px solid rgba(255,253,249,0.78)', borderRadius: '0 0 0 4px', zIndex: 3 }} />
        <span style={{ position: 'absolute', bottom: 12, right: 12, width: 18, height: 18, borderBottom: '2px solid rgba(255,253,249,0.78)', borderRight: '2px solid rgba(255,253,249,0.78)', borderRadius: '0 0 4px 0', zIndex: 3 }} />

        <div
          style={{
            position: 'relative',
            zIndex: 4,
            alignSelf: 'flex-start',
            background: 'rgba(40, 31, 26, 0.72)',
            backdropFilter: 'blur(8px)',
            padding: '5px 10px',
            borderRadius: '999px',
            fontSize: '0.67rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background:
                cameraMode === 'live'
                  ? '#EE6348'
                  : ALLOW_CAMERA_FALLBACK
                    ? '#F2A93B'
                    : '#A89A8E',
            }}
          />
          <span>
            {cameraMode === 'live'
              ? 'LIVE · 지금 찍는 사진만 업로드돼요'
              : cameraMode === 'loading'
                ? '카메라 연결 중...'
                : ALLOW_CAMERA_FALLBACK
                  ? '카메라 미연결 · 프리뷰 스냅샷 모드'
                  : '카메라 권한 또는 기기 연결 필요'}
          </span>
        </div>

        {cameraMode === 'fallback' && !ALLOW_CAMERA_FALLBACK && (
          <div
            style={{
              position: 'relative',
              zIndex: 4,
              margin: 'auto 8px',
              background: 'rgba(255, 253, 249, 0.94)',
              color: 'var(--ink-primary)',
              borderRadius: '18px',
              padding: '18px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--accent-coral-soft)',
                color: 'var(--accent-coral)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CameraIcon size={19} />
            </div>
            <div style={{ fontSize: '0.84rem', fontWeight: 800 }}>
              실시간 카메라 연결이 필요해요
            </div>
            <div
              style={{
                fontSize: '0.71rem',
                color: 'var(--ink-secondary)',
                lineHeight: 1.45,
              }}
            >
              허위 인증 방지를 위해 지금 촬영한 사진만 올릴 수 있어요.
              브라우저 카메라 권한을 허용하거나 오늘 휴식권을 사용해 주세요.
            </div>
            <button
              type="button"
              onClick={() => setRetryCount(c => c + 1)}
              style={{
                marginTop: '4px',
                border: 'none',
                background: 'var(--accent-coral)',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '0.73rem',
                fontWeight: 700,
                padding: '7px 14px',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
              }}
            >
              <RefreshIcon size={13} />
              <span>카메라 다시 연결</span>
            </button>
          </div>
        )}

        <div style={{ position: 'relative', zIndex: 4 }}>
          <div
            style={{
              display: 'inline-block',
              background: 'rgba(255, 253, 249, 0.92)',
              color: 'var(--ink-primary)',
              padding: '7px 12px',
              borderRadius: '14px',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}
          >
            <span
              className="serif-num"
              style={{
                display: 'block',
                fontSize: '0.92rem',
                color: 'var(--accent-coral)',
                fontWeight: 700,
              }}
            >
              {clock}
            </span>
            <span>{roomTitle}</span>
          </div>
        </div>
      </div>

      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="오늘 남길 짧은 한마디 (예: 귀찮았지만 20분만 채움!)"
        maxLength={40}
        disabled={!shutterAllowed}
        style={{
          width: '100%',
          background: 'rgba(255, 253, 249, 0.12)',
          border: '1px solid rgba(255, 253, 249, 0.25)',
          borderRadius: '14px',
          padding: '10px 12px',
          color: '#FAF6F0',
          fontFamily: 'inherit',
          fontSize: '0.8rem',
          outline: 'none',
          opacity: shutterAllowed ? 1 : 0.55,
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2px' }}>
        <button
          type="button"
          onClick={handleShutter}
          disabled={submitting || !shutterAllowed}
          aria-label="촬영하고 인증 올리기"
          style={{
            width: '62px',
            height: '62px',
            borderRadius: '50%',
            border: `3px solid ${shutterAllowed ? '#FAF6F0' : 'rgba(250, 246, 240, 0.35)'}`,
            background: 'transparent',
            padding: '4px',
            cursor: submitting
              ? 'wait'
              : shutterAllowed
                ? 'pointer'
                : 'not-allowed',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background:
                submitting || !shutterAllowed
                  ? '#75675C'
                  : 'var(--accent-coral)',
            }}
          />
        </button>
      </div>
      <div
        style={{
          textAlign: 'center',
          fontSize: '0.67rem',
          color: 'rgba(250, 246, 240, 0.68)',
        }}
      >
        {shutterAllowed
          ? '셔터를 누르면 실시간 타임스탬프와 함께 그룹 보드에 즉시 올라가요'
          : '실시간 카메라가 연결되면 셔터가 활성화돼요'}
      </div>
    </div>
  );
}

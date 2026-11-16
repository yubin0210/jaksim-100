export interface CameraStampMeta {
  roomTitle: string;
  tag: string;
  timestampLabel: string;
  dateLabel?: string;
}

export function formatKstClock(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hours = kst.getUTCHours();
  const mins = String(kst.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = String(hours % 12 || 12).padStart(2, '0');
  return `${h12}:${mins} ${ampm}`;
}

export function paintWarmAmbientPreview(
  canvas: HTMLCanvasElement,
  phase: number,
  tag: string
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#FBE6D1');
  grad.addColorStop(0.55, '#F3C7A9');
  grad.addColorStop(1, '#DFAA8B');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Soft sunlit window glow
  const glowX = w * 0.7 + Math.sin(phase) * 14;
  const glowY = h * 0.28 + Math.cos(phase * 0.8) * 10;
  const radial = ctx.createRadialGradient(glowX, glowY, 10, glowX, glowY, w * 0.65);
  radial.addColorStop(0, 'rgba(255, 250, 238, 0.85)');
  radial.addColorStop(1, 'rgba(255, 240, 220, 0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);

  // Cozy desk / studio silhouette
  ctx.fillStyle = 'rgba(72, 48, 36, 0.14)';
  ctx.beginPath();
  ctx.roundRect(w * 0.14, h * 0.56, w * 0.72, h * 0.24, 22);
  ctx.fill();

  // Warm notebook & mug shapes
  ctx.fillStyle = '#FFFDF9';
  ctx.beginPath();
  ctx.roundRect(w * 0.22, h * 0.48, w * 0.36, h * 0.22, 12);
  ctx.fill();

  ctx.fillStyle = '#EE6348';
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.58, w * 0.085, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFDF9';
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.58, w * 0.056, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(40, 31, 26, 0.55)';
  ctx.font = '600 18px sans-serif';
  ctx.fillText(tag, w * 0.25, h * 0.56);
}

export function captureFromStreamWithStamp(
  videoEl: HTMLVideoElement | null,
  meta: CameraStampMeta,
  fallbackCanvas?: HTMLCanvasElement | null
): string {
  const width = 600;
  const height = 760;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  if (videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const targetRatio = width / height;
    const videoRatio = vw / vh;
    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;

    if (videoRatio > targetRatio) {
      sw = vh * targetRatio;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetRatio;
      sy = (vh - sh) / 2;
    }
    ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, width, height);
  } else if (fallbackCanvas) {
    ctx.drawImage(fallbackCanvas, 0, 0, width, height);
  } else {
    paintWarmAmbientPreview(canvas, 0.6, meta.tag);
  }

  // Soft bottom gradient for readable timestamp stamp
  const scrim = ctx.createLinearGradient(0, height * 0.65, 0, height);
  scrim.addColorStop(0, 'rgba(40, 31, 26, 0)');
  scrim.addColorStop(1, 'rgba(40, 31, 26, 0.45)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, height * 0.65, width, height * 0.35);

  // Subtle corner live stamp badge
  ctx.fillStyle = 'rgba(255, 253, 249, 0.88)';
  ctx.beginPath();
  ctx.roundRect(24, 24, 210, 36, 18);
  ctx.fill();

  ctx.fillStyle = '#EE6348';
  ctx.beginPath();
  ctx.arc(44, 42, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#281F1A';
  ctx.font = '700 15px sans-serif';
  ctx.fillText(`${meta.timestampLabel} · LIVE`, 58, 47);

  return canvas.toDataURL('image/jpeg', 0.84);
}

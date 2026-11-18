import { afterEach, expect, it, vi } from 'vitest';
import { captureFromStreamWithStamp } from '@/lib/camera-adapter';

afterEach(() => vi.unstubAllGlobals());

it('does not create an image from an unavailable live frame', () => {
  const encode = vi.fn();
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: () => ({}), toDataURL: encode }),
  });
  const unloadedVideo = { readyState: 1, videoWidth: 0 } as HTMLVideoElement;
  const stamp = { roomTitle: '독서', tag: '#독서', timestampLabel: '09:30 AM' };
  expect(captureFromStreamWithStamp(unloadedVideo, stamp)).toBe('');
  expect(captureFromStreamWithStamp(null, stamp)).toBe('');
  expect(encode).not.toHaveBeenCalled();
});

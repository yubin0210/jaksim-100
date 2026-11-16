'use client';

import Link from 'next/link';
import { AlbumIcon, CompassIcon, HomeIcon } from '@/components/Icons';

export function BottomNav({ active }: { active: 'home' | 'explore' | 'album' }) {
  return (
    <nav
      aria-label="하단 내비게이션"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        background: 'rgba(255, 253, 249, 0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border-soft)',
        padding: '9px 10px calc(12px + env(safe-area-inset-bottom, 0px))',
        flexShrink: 0,
      }}
    >
      <Link
        href="/"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px',
          textDecoration: 'none',
          fontSize: '0.68rem',
          fontWeight: active === 'home' ? 800 : 600,
          color: active === 'home' ? 'var(--accent-coral)' : 'var(--ink-muted)',
        }}
      >
        <span
          style={{
            padding: '4px 14px',
            borderRadius: '999px',
            background: active === 'home' ? 'var(--accent-coral-soft)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HomeIcon size={17} />
        </span>
        <span>내 방 목록</span>
      </Link>

      <Link
        href="/explore"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px',
          textDecoration: 'none',
          fontSize: '0.68rem',
          fontWeight: active === 'explore' ? 800 : 600,
          color: active === 'explore' ? 'var(--accent-coral)' : 'var(--ink-muted)',
        }}
      >
        <span
          style={{
            padding: '4px 14px',
            borderRadius: '999px',
            background: active === 'explore' ? 'var(--accent-coral-soft)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CompassIcon size={17} />
        </span>
        <span>방 탐색</span>
      </Link>

      <Link
        href="/album"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px',
          textDecoration: 'none',
          fontSize: '0.68rem',
          fontWeight: active === 'album' ? 800 : 600,
          color: active === 'album' ? 'var(--accent-coral)' : 'var(--ink-muted)',
        }}
      >
        <span
          style={{
            padding: '4px 14px',
            borderRadius: '999px',
            background: active === 'album' ? 'var(--accent-coral-soft)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlbumIcon size={17} />
        </span>
        <span>내 앨범</span>
      </Link>
    </nav>
  );
}

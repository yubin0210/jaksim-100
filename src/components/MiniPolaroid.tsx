'use client';

import { CloudIcon, PlusIcon } from '@/components/Icons';
import type { PreviewTile } from '@/types/ongi';

export function MiniPolaroid({ tiles }: { tiles: PreviewTile[] }) {
  const count = tiles.length;
  const gridStyle: React.CSSProperties =
    count <= 1
      ? { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
      : count === 2
        ? { gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' }
        : count <= 4
          ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }
          : { gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(3, 1fr)' };

  return (
    <div
      style={{
        width: '58px',
        height: '58px',
        background: '#FFFDF9',
        border: '1px solid var(--border-soft)',
        borderRadius: '14px',
        padding: '3.5px',
        display: 'grid',
        gap: '2.5px',
        flexShrink: 0,
        boxShadow: '0 4px 10px rgba(68, 48, 34, 0.07)',
        ...gridStyle,
      }}
    >
      {tiles.map((tile, idx) => {
        const spanTwo = count === 3 && idx === 0;
        const commonStyle: React.CSSProperties = {
          borderRadius: '5px',
          overflow: 'hidden',
          gridColumn: spanTwo ? 'span 2' : undefined,
        };

        if (tile.status === 'photo' && tile.imageData) {
          return (
            <div
              key={`${tile.nickname}-${idx}`}
              style={{ ...commonStyle, background: '#F4DFCE' }}
            >
              <img
                src={tile.imageData}
                alt={tile.nickname}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          );
        }

        if (tile.status === 'rest') {
          return (
            <div
              key={`${tile.nickname}-${idx}`}
              style={{
                ...commonStyle,
                background: 'var(--accent-honey-soft)',
                color: '#9A640E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CloudIcon size={10} />
            </div>
          );
        }

        return (
          <div
            key={`${tile.nickname}-${idx}`}
            style={{
              ...commonStyle,
              border: '1px dashed #EE9B88',
              background: 'var(--accent-coral-soft)',
              color: 'var(--accent-coral)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PlusIcon size={10} />
          </div>
        );
      })}
    </div>
  );
}

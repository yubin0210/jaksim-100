import Link from 'next/link';
import { AlbumIcon, CompassIcon, HomeIcon } from './Icons';

const destinations = [
  { key: 'home', href: '/', label: '내 방', Icon: HomeIcon },
  { key: 'explore', href: '/explore', label: '방 탐색', Icon: CompassIcon },
  { key: 'album', href: '/album', label: '내 앨범', Icon: AlbumIcon },
] as const;

export function BottomNav({
  active,
}: {
  active: 'home' | 'explore' | 'album';
}) {
  return (
    <nav className="app-nav" aria-label="주요 메뉴">
      {destinations.map(({ key, href, label, Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? 'page' : undefined}
        >
          <Icon size={19} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

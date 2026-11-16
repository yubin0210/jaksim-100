import { AlbumClient } from '@/components/AlbumClient';
import { getAlbumEntries } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export default function AlbumPage() {
  const album = getAlbumEntries();

  return <AlbumClient initialAlbum={album} />;
}

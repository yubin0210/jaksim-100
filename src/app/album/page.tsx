import { redirect } from 'next/navigation';
import { AlbumClient } from '@/components/AlbumClient';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAlbumEntries } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export default async function AlbumPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/auth');
  }

  const album = await getAlbumEntries(user);

  return <AlbumClient initialAlbum={album} />;
}

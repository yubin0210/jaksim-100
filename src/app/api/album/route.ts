import { requireAuthenticatedUser } from '@/lib/auth';
import { getAlbumEntries } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? undefined;
  const roomId = searchParams.get('roomId') ?? undefined;

  const album = await getAlbumEntries(auth.user, { month, roomId });
  return Response.json(album, { status: 200 });
}

import { getAlbumEntries } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? undefined;
  const roomId = searchParams.get('roomId') ?? undefined;

  const album = getAlbumEntries({ month, roomId });
  return Response.json(album, { status: 200 });
}

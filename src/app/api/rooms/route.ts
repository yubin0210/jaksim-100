import { requireAuthenticatedUser } from '@/lib/auth';
import { createRoom, listRoomsOverview } from '@/lib/repository';
import type { RoomCapacity } from '@/types/ongi';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') ?? undefined;
  const filter = searchParams.get('filter') ?? undefined;

  const overview = await listRoomsOverview(auth.user, { query, filter });
  return Response.json(overview, { status: 200 });
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  let body: { title?: unknown; tag?: unknown; category?: unknown; maxCapacity?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '잘못된 JSON 요청이에요.' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const tag = typeof body.tag === 'string' ? body.tag.trim() : '';
  if (!title) {
    return Response.json({ error: '방 이름을 입력해 주세요.' }, { status: 400 });
  }
  if (!tag) {
    return Response.json({ error: '주제 태그를 입력해 주세요.' }, { status: 400 });
  }

  const rawCap = Number(body.maxCapacity);
  const maxCapacity: RoomCapacity = rawCap === 2 || rawCap === 6 ? rawCap : 4;
  const category = typeof body.category === 'string' ? body.category : undefined;

  const room = await createRoom(auth.user, { title, tag, category, maxCapacity });
  return Response.json({ room }, { status: 201 });
}

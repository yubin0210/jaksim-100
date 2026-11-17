import { requireAuthenticatedUser } from '@/lib/auth';
import { getRoomDetail } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') ?? undefined;

  const detail = await getRoomDetail(auth.user, id, date);
  if (!detail) {
    return Response.json({ error: '방을 찾을 수 없어요.' }, { status: 404 });
  }

  return Response.json(detail, { status: 200 });
}

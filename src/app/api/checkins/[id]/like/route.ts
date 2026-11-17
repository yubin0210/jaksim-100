import { requireAuthenticatedUser } from '@/lib/auth';
import { toggleCheckinLike } from '@/lib/repository';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const result = await toggleCheckinLike(auth.user, id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ checkin: result.checkin }, { status: 200 });
}

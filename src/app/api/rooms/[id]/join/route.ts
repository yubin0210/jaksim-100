import { requireAuthenticatedUser } from '@/lib/auth';
import { joinRoom } from '@/lib/repository';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const result = await joinRoom(auth.user, id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ room: result.room }, { status: 200 });
}

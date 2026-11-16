import { toggleCheckinLike } from '@/lib/repository';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const result = toggleCheckinLike(id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ checkin: result.checkin }, { status: 200 });
}

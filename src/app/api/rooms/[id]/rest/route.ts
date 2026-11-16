import { submitRestPass } from '@/lib/repository';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const result = submitRestPass(id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(
    { checkin: result.checkin, room: result.room },
    { status: 201 }
  );
}

import { submitPhotoCheckin } from '@/lib/repository';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  let body: { imageData?: unknown; note?: unknown; timestampLabel?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '잘못된 JSON 요청이에요.' }, { status: 400 });
  }

  const imageData = typeof body.imageData === 'string' ? body.imageData : '';
  const note = typeof body.note === 'string' ? body.note : '';
  const timestampLabel =
    typeof body.timestampLabel === 'string' ? body.timestampLabel : undefined;

  const result = submitPhotoCheckin(id, { imageData, note, timestampLabel });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(
    { checkin: result.checkin, room: result.room },
    { status: 201 }
  );
}

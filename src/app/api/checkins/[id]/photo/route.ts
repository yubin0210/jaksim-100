import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response(null, { status: 401 });
  const { data: row, error } = await supabase
    .from('daily_checkins')
    .select('user_id, room_id, image_data')
    .eq('id', id)
    .eq('status', 'photo')
    .maybeSingle();
  if (error) return new Response(null, { status: 503 });
  // Both the original public URLs and new storage paths end in the uploaded extension.
  const ext = row?.image_data?.match(/\.(jpg|jpeg|png|webp)$/i)?.[1];
  if (!row || !ext) return new Response(null, { status: 404 });
  const path = [row.user_id, row.room_id, id + '.' + ext].join('/');
  const { data: image, error: downloadError } = await supabase.storage
    .from('checkins')
    .download(path);
  if (downloadError || !image) return new Response(null, { status: 404 });
  return new Response(image, {
    headers: {
      'Content-Type': image.type,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

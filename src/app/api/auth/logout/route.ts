import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return Response.json({ ok: true }, { status: 200 });
}

import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.auth.signOut();
  if (error) return Response.json({error: '로그아웃하지 못했어요.'}, {status: 503});
  return Response.json({ ok: true }, { status: 200 });
}

import { deriveProfileFallback, translateAuthError } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '잘못된 JSON 요청이에요.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return Response.json(
      { error: '이메일과 비밀번호를 모두 입력해 주세요.' },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return Response.json(
      { error: translateAuthError(error?.message || 'Invalid login credentials') },
      { status: 401 }
    );
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, email, nickname, avatar_initial')
    .eq('id', data.user.id)
    .maybeSingle();

  const user = profileRow
    ? {
        id: profileRow.id,
        email: profileRow.email,
        nickname: profileRow.nickname,
        avatarInitial: profileRow.avatar_initial,
      }
    : deriveProfileFallback({
        id: data.user.id,
        email: data.user.email,
        nickname: data.user.user_metadata?.nickname,
      });

  return Response.json({ user }, { status: 200 });
}

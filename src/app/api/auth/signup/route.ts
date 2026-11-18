import { deriveProfileFallback, translateAuthError } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown; nickname?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '잘못된 JSON 요청이에요.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: '올바른 이메일 주소를 입력해 주세요.' }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 });
  }
  if (nickname.length < 2 || nickname.length > 12) {
    return Response.json(
      { error: '닉네임은 2자 이상 12자 이하로 입력해 주세요.' },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: new URL('/auth/callback', process.env.APP_ORIGIN || req.url).href,
      data: { nickname },
    },
  });

  if (error) {
    const status = error.message.toLowerCase().includes('already') ? 409 : 400;
    return Response.json({ error: translateAuthError(error.message) }, { status });
  }

  if (!data.user) {
    return Response.json(
      { error: '회원가입을 완료하지 못했어요.' },
      { status: 400 }
    );
  }

  // Supabase returns empty identities when email already exists and confirmation is active
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return Response.json({ error: '이미 가입된 이메일이에요.' }, { status: 409 });
  }

  const profile = deriveProfileFallback({
    id: data.user.id,
    email: data.user.email,
    nickname,
  });

  return Response.json(
    {
      user: profile,
      needsEmailConfirmation: !data.session,
    },
    { status: 201 }
  );
}

import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/types/ongi';

const g = globalThis as unknown as {
  __ongiTestUserOverride?: UserProfile | null;
};

export function setTestUserOverride(user: UserProfile | null): void {
  g.__ongiTestUserOverride = user;
}

export function resetTestUserOverride(): void {
  delete g.__ongiTestUserOverride;
}

export function deriveProfileFallback(params: {
  id: string;
  email?: string | null;
  nickname?: unknown;
}): UserProfile {
  const email = params.email ?? '';
  const rawNick =
    typeof params.nickname === 'string' && params.nickname.trim()
      ? params.nickname.trim()
      : email.split('@')[0]?.trim() || '온기메이트';
  const nickname = rawNick.slice(0, 12);
  const avatarInitial = nickname.slice(0, 1) || '온';
  return {
    id: params.id,
    email,
    nickname,
    avatarInitial,
  };
}

export async function getAuthenticatedUser(): Promise<UserProfile | null> {
  if (Object.prototype.hasOwnProperty.call(g, '__ongiTestUserOverride')) {
    return g.__ongiTestUserOverride ?? null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, nickname, avatar_initial')
    .eq('id', user.id)
    .maybeSingle();

  if (profile) {
    return {
      id: profile.id,
      email: profile.email,
      nickname: profile.nickname,
      avatarInitial: profile.avatar_initial,
    };
  }

  return deriveProfileFallback({
    id: user.id,
    email: user.email,
    nickname: user.user_metadata?.nickname,
  });
}

export async function requireAuthenticatedUser(): Promise<
  { ok: true; user: UserProfile } | { ok: false; response: Response }
> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: '로그인이 필요해요.' }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

export function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않아요.';
  }
  if (lower.includes('email not confirmed')) {
    return '이메일 인증 확인 후 로그인해 주세요.';
  }
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return '이미 가입된 이메일이에요.';
  }
  if (lower.includes('password') && lower.includes('6')) {
    return '비밀번호는 6자 이상 입력해 주세요.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
  }
  if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
    return '올바른 이메일 형식을 입력해 주세요.';
  }
  return '인증 처리 중 문제가 발생했어요. 다시 시도해 주세요.';
}

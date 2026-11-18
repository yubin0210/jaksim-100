import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as signUp } from '@/app/api/auth/signup/route';
import { GET as confirm } from '@/app/auth/callback/route';
import { updateSession } from '@/lib/supabase/middleware';

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth }),
}));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

const origin = 'http://127.0.0.1:3109';
const callback = origin + '/auth/callback';

it('uses the public app address in signup emails even behind a proxy', async () => {
  vi.stubEnv('APP_ORIGIN', origin);
  auth.signUp.mockResolvedValue({ data: { user: { id: 'test-user' } } });
  const result = await signUp(new Request('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email: 'tester@example.com', password: 'testing123', nickname: '테스터' }),
  }));
  expect(result.status).toBe(201);
  expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
    options: { emailRedirectTo: callback, data: { nickname: '테스터' } },
  }));
});

it('exchanges the code and sends the browser home without the code', async () => {
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  const result = await confirm(new Request(callback + '?code=test-code'));
  expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('test-code');
  expect(result.status).toBe(303);
  expect(result.headers.get('location')).toBe('/');
  expect(result.headers.get('cache-control')).toContain('no-store');
});

it('opens the login screen if the browser has no verifier', async () => {
  auth.exchangeCodeForSession.mockResolvedValue({ error: { message: 'missing verifier' } });
  const result = await confirm(new Request(callback + '?code=test-code'));
  expect(result.headers.get('location')).toBe('/auth?confirmation=login');
});

it.each(['', '?error=access_denied&error_code=otp_expired'])(
  'shows link guidance for a missing or expired code', async query => {
    const result = await confirm(new Request(callback + query));
    expect(result.headers.get('location')).toBe('/auth?confirmation=link');
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  }
);

it('keeps the code from emails that return to the old site root', async () => {
  const res = await updateSession(new NextRequest(origin + '/?code=test-code'));
  const rewritten = new URL(res.headers.get('x-middleware-rewrite')!);
  expect(rewritten.pathname).toBe('/auth/callback');
  expect(rewritten.searchParams.get('code')).toBe('test-code');
});

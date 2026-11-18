import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  let destination = '/auth?confirmation=link';

  if (code && !params.has('error')) {
    destination = '/auth?confirmation=login';
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) destination = '/';
    } catch {
      // Email confirmation can succeed even when the session exchange is interrupted.
    }
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: destination,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

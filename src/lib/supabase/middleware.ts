import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === '/auth/callback') return NextResponse.next();

  // Older confirmation emails return to the Site URL with the code in its query.
  if (pathname === '/' && (searchParams.has('code') || searchParams.has('error'))) {
    const callback = request.nextUrl.clone();
    callback.pathname = '/auth/callback';
    return NextResponse.rewrite(callback);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (pathname.startsWith('/api/auth')) {
    return supabaseResponse;
  }

  if (pathname.startsWith('/api/')) {
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
    }
    return supabaseResponse;
  }

  const isAuthPage = pathname === '/auth' || pathname.startsWith('/auth/');

  if (isAuthPage) {
    if (user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/';
      redirectUrl.search = '';
      const redirectResponse = NextResponse.redirect(redirectUrl);
      supabaseResponse.cookies.getAll().forEach(c => redirectResponse.cookies.set(c));
      return redirectResponse;
    }
    return supabaseResponse;
  }

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/auth';
    redirectUrl.search = '';
    if (/^\/(?:rooms\/[\w-]+|explore|album)$/.test(pathname)) redirectUrl.searchParams.set('next', pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach(c => redirectResponse.cookies.set(c));
    return redirectResponse;
  }

  return supabaseResponse;
}

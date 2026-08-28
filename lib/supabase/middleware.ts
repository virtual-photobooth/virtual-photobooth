import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Protected Admin Routes (/admin/*)
  if (pathname.startsWith('/admin')) {
    if (!user) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    // Verify owner role
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'owner') {
      url.pathname = '/client';
      return NextResponse.redirect(url);
    }
  }

  // Protected Client Routes (/client/*)
  if (pathname.startsWith('/client')) {
    const clientCookie = request.cookies.get('client_session')?.value;
    if (!user && !clientCookie) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  // Auth pages redirect if already logged in
  if (pathname === '/login' && user) {
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'owner') {
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    } else {
      url.pathname = '/client';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

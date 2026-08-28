import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const ownerCookie = cookieStore.get('owner_session')?.value;
    const clientCookie = cookieStore.get('client_session')?.value;

    if (ownerCookie || clientCookie) {
      const email = decodeURIComponent(ownerCookie || clientCookie || 'owner@photobooth.com');
      return NextResponse.json({ authenticated: true, email });
    }

    // Fallback: Check Supabase Auth
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        return NextResponse.json({
          authenticated: true,
          email: user.email || 'Owner Admin',
        });
      }
    }

    return NextResponse.json({ authenticated: false }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 401 });
  }
}

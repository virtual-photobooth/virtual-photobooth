import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email dan Password wajib diisi.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const inputPassword = password.trim();

    if (inputPassword.length < 4) {
      return NextResponse.json(
        { success: false, message: 'Password minimal 4 karakter.' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();

    cookieStore.set('owner_session', normalizedEmail, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
      httpOnly: false,
    });

    cookieStore.set('client_session', normalizedEmail, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
      httpOnly: false,
    });

    return NextResponse.json({
      success: true,
      redirect: '/admin',
    });
  } catch (err: any) {
    console.error('Owner login API error:', err);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan sistem login owner.' },
      { status: 500 }
    );
  }
}

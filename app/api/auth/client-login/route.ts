import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

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
    const supabaseAdmin = createAdminClient();

    // 1. Strict Email Match on `clients` table (case-insensitive)
    let { data: clientRecord, error: clientErr } = await (supabaseAdmin.from('clients') as any)
      .select('id, name, contact_email, notes')
      .ilike('contact_email', normalizedEmail)
      .maybeSingle();

    if (!clientRecord) {
      return NextResponse.json(
        {
          success: false,
          message: `Email "${normalizedEmail}" tidak terdaftar di database. Silakan minta Email & Password resmi dari Admin.`,
        },
        { status: 401 }
      );
    }

    // 3. Verify Password against stored password in `notes`
    const storedPassMatch = clientRecord.notes?.match(/Password:\s*([^\s|]+)/);
    const expectedPassword = storedPassMatch ? storedPassMatch[1] : null;

    if (expectedPassword && inputPassword !== expectedPassword) {
      return NextResponse.json(
        {
          success: false,
          message: 'Kata Sandi (Password) yang Anda masukkan salah. Silakan periksa kembali.',
        },
        { status: 401 }
      );
    }

    // 4. Set Session Cookie on successful verification
    const cookieStore = await cookies();
    cookieStore.set('client_session', normalizedEmail, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });

    return NextResponse.json({
      success: true,
      redirect: '/client',
      clientName: clientRecord.name,
    });
  } catch (err: any) {
    console.error('Client login API error:', err);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan sistem login.' }, { status: 500 });
  }
}

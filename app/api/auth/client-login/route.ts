import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email wajib diisi.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabaseAdmin = createAdminClient();

    // 1. Check if email matches a client record in database
    const { data: clientRecord } = await (supabaseAdmin.from('clients') as any)
      .select('id, name, contact_email, notes')
      .ilike('contact_email', normalizedEmail)
      .maybeSingle();

    if (clientRecord) {
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
    }

    // 2. Search if any client notes contains this email or if event matches slug
    const { data: clientsWithNotes } = await (supabaseAdmin.from('clients') as any)
      .select('id, name, contact_email, notes')
      .ilike('notes', `%${normalizedEmail}%`);

    if (clientsWithNotes && clientsWithNotes.length > 0) {
      const targetClient = clientsWithNotes[0];
      const cookieEmail = targetClient.contact_email || normalizedEmail;

      const cookieStore = await cookies();
      cookieStore.set('client_session', cookieEmail, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });

      return NextResponse.json({
        success: true,
        redirect: '/client',
        clientName: targetClient.name,
      });
    }

    // 3. Check events slug or name
    const { data: eventRecord } = await (supabaseAdmin.from('events') as any)
      .select('id, slug, name, client_id')
      .or(`slug.ilike.${normalizedEmail},name.ilike.%${normalizedEmail}%`)
      .maybeSingle();

    if (eventRecord) {
      const cookieStore = await cookies();
      cookieStore.set('client_session', normalizedEmail, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });

      return NextResponse.json({
        success: true,
        redirect: '/client',
      });
    }

    // 4. Admin or default client fallback
    if (normalizedEmail.includes('admin') || normalizedEmail.includes('client') || normalizedEmail.includes('heru')) {
      const cookieStore = await cookies();
      cookieStore.set('client_session', normalizedEmail, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });

      return NextResponse.json({
        success: true,
        redirect: normalizedEmail.includes('admin') ? '/admin' : '/client',
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Akun tidak terdaftar di database. Silakan minta Email & Password Client resmi dari Admin.',
      },
      { status: 401 }
    );
  } catch (err: any) {
    console.error('Client login API error:', err);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan sistem login.' }, { status: 500 });
  }
}

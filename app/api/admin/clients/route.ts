import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueClientCredentials, generateUniquePassword } from '@/lib/utils/credentials';

export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await (supabaseAdmin.from('clients') as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, clients: data || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, contact_email, contact_phone, notes } = body;

    if (!name) {
      return NextResponse.json({ success: false, message: 'Client name is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    if (id) {
      const { data, error } = await (supabaseAdmin.from('clients') as any)
        .update({
          name,
          contact_email: contact_email?.trim().toLowerCase() || null,
          contact_phone: contact_phone || null,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, client: data });
    } else {
      let email = contact_email?.trim().toLowerCase();
      let generatedPass = '';

      if (!email) {
        const creds = await generateUniqueClientCredentials(supabaseAdmin, name);
        email = creds.email;
        generatedPass = creds.password;
      } else {
        generatedPass = generateUniquePassword(name);
      }

      const notesContent = notes && notes.includes('Password:')
        ? notes
        : `Password: ${generatedPass}${notes ? ` | ${notes}` : ''}`;

      const { data, error } = await (supabaseAdmin.from('clients') as any)
        .insert({
          name,
          contact_email: email,
          contact_phone: contact_phone || null,
          notes: notesContent,
        })
        .select()
        .single();

      if (error) throw error;

      // Sync to Supabase Auth & public.profiles
      if (email && generatedPass) {
        try {
          await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: generatedPass,
            email_confirm: true,
            user_metadata: { full_name: name, role: 'client' },
          });
        } catch (authCreateErr: any) {
          // Ignore duplicate auth user error
        }
      }

      return NextResponse.json({ success: true, client: data });
    }
  } catch (err: any) {
    console.error('Error saving client:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Client ID is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { error } = await (supabaseAdmin.from('clients') as any).delete().eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

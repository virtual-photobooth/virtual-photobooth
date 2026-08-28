import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueClientCredentials, generateUniquePassword } from '@/lib/utils/credentials';

export async function POST(request: Request) {
  try {
    const { eventId } = await request.json();

    if (!eventId) {
      return NextResponse.json({ success: false, message: 'Event ID is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. Fetch event with client
    const { data: event, error: eventErr } = await (supabaseAdmin.from('events') as any)
      .select('*, client:clients(*)')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return NextResponse.json({ success: false, message: 'Event not found' }, { status: 404 });
    }

    let client = event.client;
    let clientId = event.client_id;

    // 2. If event has no client record, create one and save to database
    if (!clientId || !client) {
      const hostName = `${event.name} Host`;
      const creds = await generateUniqueClientCredentials(supabaseAdmin, event.name || 'Event Host');

      const { data: newClient, error: createErr } = await (supabaseAdmin.from('clients') as any)
        .insert({
          name: hostName,
          contact_email: creds.email,
          notes: `Password: ${creds.password} | Auto-generated credentials`,
        })
        .select()
        .single();

      if (createErr) throw createErr;

      clientId = newClient.id;
      client = newClient;

      await (supabaseAdmin.from('events') as any)
        .update({ client_id: clientId })
        .eq('id', eventId);
    } else {
      // 3. If client exists but contact_email or password in notes is missing, generate and save to database
      let email = client.contact_email?.trim().toLowerCase();
      let notes = client.notes || '';
      let hasPass = notes.includes('Password:');

      if (!email || !hasPass) {
        if (!email) {
          const creds = await generateUniqueClientCredentials(supabaseAdmin, client.name || event.name);
          email = creds.email;
        }
        if (!hasPass) {
          const generatedPass = generateUniquePassword(client.name || event.name);
          notes = `Password: ${generatedPass}${notes ? ` | ${notes}` : ''}`;
        }

        const { data: updatedClient, error: updateErr } = await (supabaseAdmin.from('clients') as any)
          .update({
            contact_email: email,
            notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', clientId)
          .select()
          .single();

        if (!updateErr && updatedClient) {
          client = updatedClient;
        }
      }
    }

    const storedPassMatch = client?.notes?.match(/Password:\s*([^\s|]+)/);
    const password = storedPassMatch
      ? storedPassMatch[1]
      : generateUniquePassword(client?.name || event.name);

    // Sync to Supabase Auth & public.profiles (only if SUPABASE_SERVICE_ROLE_KEY is provided)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && client?.contact_email && password) {
      try {
        await supabaseAdmin.auth.admin.createUser({
          email: client.contact_email,
          password: password,
          email_confirm: true,
          user_metadata: { full_name: client.name || 'Client Host', role: 'client' },
        });
      } catch (authCreateErr: any) {
        console.warn('Auth user creation warning:', authCreateErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      email: client?.contact_email,
      password: password,
      clientName: client?.name,
    });
  } catch (err: any) {
    console.error('Error syncing credentials:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

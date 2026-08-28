import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const clientSession = cookieStore.get('client_session')?.value;

    if (!clientSession) {
      return NextResponse.json({
        client: null,
        events: [],
        guests: [],
        photos: [],
        voiceMessages: [],
        counts: { guests: 0, photos: 0, voices: 0 },
      });
    }

    const email = decodeURIComponent(clientSession).trim().toLowerCase();
    const supabaseAdmin = createAdminClient();

    // 1. Find client record matching contact_email
    let { data: clientRecord } = await (supabaseAdmin.from('clients') as any)
      .select('*')
      .ilike('contact_email', email)
      .maybeSingle();

    // Fallback: Check if notes contains email
    if (!clientRecord) {
      const { data: clientsByNotes } = await (supabaseAdmin.from('clients') as any)
        .select('*')
        .ilike('notes', `%${email}%`);

      if (clientsByNotes && clientsByNotes.length > 0) {
        clientRecord = clientsByNotes[0];
      }
    }

    // 2. Fetch events assigned to this client
    let events: any[] = [];
    if (clientRecord) {
      const { data: clientEvents } = await (supabaseAdmin.from('events') as any)
        .select('*')
        .eq('client_id', clientRecord.id)
        .order('created_at', { ascending: false });

      events = clientEvents || [];
    }

    // 3. Fallback matching if client_id is not directly linked on events
    if (events.length === 0) {
      const { data: allEvents } = await (supabaseAdmin.from('events') as any)
        .select('*, client:clients(*)')
        .order('created_at', { ascending: false });

      if (allEvents && allEvents.length > 0) {
        const matched = allEvents.filter(
          (e: any) =>
            e.client_id === clientRecord?.id ||
            e.client?.contact_email?.toLowerCase() === email ||
            e.slug?.toLowerCase().includes(email) ||
            e.name?.toLowerCase().includes(email)
        );
        if (matched.length > 0) {
          events = matched;
        } else if (allEvents.length === 1) {
          // Single event in system
          events = [allEvents[0]];
        }
      }
    }

    const eventIds = events.map((e: any) => e.id);

    if (eventIds.length === 0) {
      return NextResponse.json({
        client: clientRecord || null,
        events: [],
        guests: [],
        photos: [],
        voiceMessages: [],
        counts: { guests: 0, photos: 0, voices: 0 },
      });
    }

    // 4. Fetch guests, photos, and voice messages
    const [{ data: guestsData }, { data: photosData }, { data: voicesData }] = await Promise.all([
      (supabaseAdmin.from('guests') as any)
        .select('*')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false }),
      (supabaseAdmin.from('photos') as any)
        .select('*, guest:guests(name)')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false }),
      (supabaseAdmin.from('voice_messages') as any)
        .select('*, guest:guests(name)')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false }),
    ]);

    // 5. Resolve storage public URLs
    const resolvedPhotos = (photosData || []).map((p: any) => {
      const { data: urlData } = supabaseAdmin.storage.from('virtual-photobooth').getPublicUrl(p.final_photo_path);
      return { ...p, publicUrl: urlData?.publicUrl || '' };
    });

    const resolvedVoices = (voicesData || []).map((v: any) => {
      const { data: urlData } = supabaseAdmin.storage.from('virtual-photobooth').getPublicUrl(v.audio_path);
      return { ...v, publicUrl: urlData?.publicUrl || '' };
    });

    return NextResponse.json({
      client: clientRecord || null,
      events,
      guests: guestsData || [],
      photos: resolvedPhotos,
      voiceMessages: resolvedVoices,
      counts: {
        guests: (guestsData || []).length,
        photos: (photosData || []).length,
        voices: (voicesData || []).length,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/client/data:', err);
    return NextResponse.json({ error: err.message || 'Failed to load client data' }, { status: 500 });
  }
}

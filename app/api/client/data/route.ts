import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const clientSession = cookieStore.get('client_session')?.value;
    const supabaseAdmin = createAdminClient();

    let email = clientSession ? decodeURIComponent(clientSession).trim().toLowerCase() : null;
    let clientRecord: any = null;
    let events: any[] = [];

    if (email) {
      // 1. Find client record matching contact_email
      const { data: record } = await (supabaseAdmin.from('clients') as any)
        .select('*')
        .ilike('contact_email', email)
        .maybeSingle();
      clientRecord = record;

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
    } else {
      // If no session cookie, check for active event to allow seamless preview/testing
      const { data: allEvents } = await (supabaseAdmin.from('events') as any)
        .select('*, client:clients(*)')
        .order('created_at', { ascending: false })
        .limit(1);

      if (allEvents && allEvents.length > 0) {
        events = allEvents;
        clientRecord = allEvents[0].client || null;
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

    // 5. Resolve storage public URLs and link voice messages to photos
    const voiceMap = new Map<string, any>();
    const voiceByNameMap = new Map<string, any>();

    const resolvedVoices = (voicesData || []).map((v: any) => {
      const { data: urlData } = supabaseAdmin.storage.from('virtual-photobooth').getPublicUrl(v.audio_path);
      const enrichedVoice = { ...v, publicUrl: urlData?.publicUrl || '' };
      if (v.guest_id) {
        voiceMap.set(v.guest_id, enrichedVoice);
      }
      if (v.guest?.name) {
        voiceByNameMap.set(v.guest.name.trim().toLowerCase(), enrichedVoice);
      }
      return enrichedVoice;
    });

    const resolvedPhotos = (photosData || []).map((p: any) => {
      const { data: urlData } = supabaseAdmin.storage.from('virtual-photobooth').getPublicUrl(p.final_photo_path);
      const guestNameKey = (p.guest?.name || p.guest_name || '').trim().toLowerCase();
      const matchingVoice = (p.guest_id ? voiceMap.get(p.guest_id) : null) || (guestNameKey ? voiceByNameMap.get(guestNameKey) : null);

      return {
        ...p,
        publicUrl: urlData?.publicUrl || '',
        voiceUrl: matchingVoice?.publicUrl || null,
        voiceDuration: matchingVoice?.duration_seconds || null,
        voiceId: matchingVoice?.id || null,
      };
    });

    const enrichedEvents = events.map((e: any) => {
      let coverUrl = null;
      let frameUrl = null;
      if (e.cover_path) {
        const { data: cData } = supabaseAdmin.storage.from('virtual-photobooth').getPublicUrl(e.cover_path);
        coverUrl = cData?.publicUrl || null;
      }
      if (e.frame_path) {
        const { data: fData } = supabaseAdmin.storage.from('virtual-photobooth').getPublicUrl(e.frame_path);
        frameUrl = fData?.publicUrl || null;
      }
      return { ...e, coverUrl, frameUrl };
    });

    return NextResponse.json({
      client: clientRecord || null,
      events: enrichedEvents,
      guests: guestsData || [],
      photos: resolvedPhotos,
      voiceMessages: resolvedVoices,
      counts: {
        guests: (guestsData || []).length,
        photos: (photosData || []).length,
        voices: resolvedVoices.length,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/client/data:', err);
    return NextResponse.json({ error: err.message || 'Failed to load client data' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { type, id } = await request.json();

    if (!type || !id) {
      return NextResponse.json({ error: 'Tipe dan ID wajib disertakan.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    if (type === 'photo') {
      // 1. Fetch photo to get storage path and guest_id
      const { data: photo, error: fetchErr } = await (supabaseAdmin.from('photos') as any)
        .select('id, guest_id, final_photo_path')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) {
        console.error('Error fetching photo for deletion:', fetchErr);
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      }

      if (!photo) {
        return NextResponse.json({ error: 'Foto tidak ditemukan.' }, { status: 404 });
      }

      // 2. Remove photo files from Supabase storage
      if (photo.final_photo_path) {
        await supabaseAdmin.storage.from('virtual-photobooth').remove([photo.final_photo_path]);
      }

      // 3. If photo is linked to a guest, cascade delete voice message & guest entry
      if (photo.guest_id) {
        // Find voice messages belonging to this guest
        const { data: guestVoices } = await (supabaseAdmin.from('voice_messages') as any)
          .select('id, audio_path')
          .eq('guest_id', photo.guest_id);

        if (guestVoices && guestVoices.length > 0) {
          const audioPaths = guestVoices.map((v: any) => v.audio_path).filter(Boolean);
          if (audioPaths.length > 0) {
            await supabaseAdmin.storage.from('virtual-photobooth').remove(audioPaths);
          }
          await (supabaseAdmin.from('voice_messages') as any)
            .delete()
            .eq('guest_id', photo.guest_id);
        }

        // Delete photo record first
        await (supabaseAdmin.from('photos') as any).delete().eq('id', id);

        // Delete guest record so guest list stays completely clean
        await (supabaseAdmin.from('guests') as any).delete().eq('id', photo.guest_id);

        return NextResponse.json({
          success: true,
          message: 'Foto dan data tamu terkait berhasil dihapus.',
          deletedGuestId: photo.guest_id,
        });
      }

      // 4. Delete photo record from database (if no guest_id)
      const { error: deleteErr } = await (supabaseAdmin.from('photos') as any)
        .delete()
        .eq('id', id);

      if (deleteErr) {
        return NextResponse.json({ error: deleteErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Foto berhasil dihapus.' });
    } else if (type === 'guest') {
      // Direct guest deletion: Clean up their photos, voice, and guest record
      const [{ data: guestPhotos }, { data: guestVoices }] = await Promise.all([
        (supabaseAdmin.from('photos') as any).select('id, final_photo_path').eq('guest_id', id),
        (supabaseAdmin.from('voice_messages') as any).select('id, audio_path').eq('guest_id', id),
      ]);

      const photoPaths = (guestPhotos || []).map((p: any) => p.final_photo_path).filter(Boolean);
      const voicePaths = (guestVoices || []).map((v: any) => v.audio_path).filter(Boolean);
      const allPaths = [...photoPaths, ...voicePaths];

      if (allPaths.length > 0) {
        await supabaseAdmin.storage.from('virtual-photobooth').remove(allPaths);
      }

      await Promise.all([
        (supabaseAdmin.from('photos') as any).delete().eq('guest_id', id),
        (supabaseAdmin.from('voice_messages') as any).delete().eq('guest_id', id),
      ]);

      await (supabaseAdmin.from('guests') as any).delete().eq('id', id);

      return NextResponse.json({ success: true, message: 'Tamu dan seluruh kenangan berhasil dihapus.' });
    } else if (type === 'voice') {
      // 1. Fetch voice message to get storage path
      const { data: voice } = await (supabaseAdmin.from('voice_messages') as any)
        .select('id, audio_path')
        .eq('id', id)
        .maybeSingle();

      if (!voice) {
        return NextResponse.json({ error: 'Pesan suara tidak ditemukan.' }, { status: 404 });
      }

      // 2. Remove audio file from storage
      if (voice.audio_path) {
        await supabaseAdmin.storage.from('virtual-photobooth').remove([voice.audio_path]);
      }

      // 3. Delete record from database
      const { error: deleteErr } = await (supabaseAdmin.from('voice_messages') as any)
        .delete()
        .eq('id', id);

      if (deleteErr) {
        return NextResponse.json({ error: deleteErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Pesan suara berhasil dihapus.' });
    }

    return NextResponse.json({ error: 'Tipe tidak valid. Harus photo, guest, atau voice.' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in DELETE /api/client/data:', err);
    return NextResponse.json({ error: err.message || 'Gagal menghapus item.' }, { status: 500 });
  }
}


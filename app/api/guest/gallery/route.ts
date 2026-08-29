import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSlug } from '@/lib/utils/slug';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slugParam = searchParams.get('slug');
    const eventIdParam = searchParams.get('eventId');

    if (!slugParam && !eventIdParam) {
      return NextResponse.json({ success: false, message: 'Slug atau Event ID diperlukan.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. Fetch Event Details
    let event: any = null;

    if (eventIdParam) {
      const { data } = await (supabaseAdmin.from('events') as any)
        .select('*')
        .eq('id', eventIdParam)
        .maybeSingle();
      if (data) event = data;
    }

    if (!event && slugParam) {
      const decodedSlug = decodeURIComponent(slugParam);
      const normalizedSlug = generateSlug(decodedSlug);

      let { data } = await (supabaseAdmin.from('events') as any)
        .select('*')
        .eq('slug', decodedSlug)
        .maybeSingle();

      if (!data && normalizedSlug) {
        const { data: normData } = await (supabaseAdmin.from('events') as any)
          .select('*')
          .eq('slug', normalizedSlug)
          .maybeSingle();
        if (normData) data = normData;
      }

      if (!data) {
        const { data: ilikeData } = await (supabaseAdmin.from('events') as any)
          .select('*')
          .ilike('slug', decodedSlug)
          .maybeSingle();
        if (ilikeData) data = ilikeData;
      }

      if (!data) {
        const { data: idData } = await (supabaseAdmin.from('events') as any)
          .select('*')
          .eq('id', decodedSlug)
          .maybeSingle();
        if (idData) data = idData;
      }

      if (data) event = data;
    }

    if (!event) {
      return NextResponse.json({ success: false, message: 'Event tidak ditemukan.' }, { status: 404 });
    }

    // Resolve cover URL
    let coverPublicUrl: string | null = null;
    if (event.cover_path) {
      const { data: coverUrlData } = supabaseAdmin.storage
        .from('virtual-photobooth')
        .getPublicUrl(event.cover_path);
      coverPublicUrl = coverUrlData?.publicUrl || null;
    }

    // 2. Fetch Photos for this Event
    let photos: any[] = [];
    const { data: rawPhotos, error: photosErr } = await (supabaseAdmin.from('photos') as any)
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: false });

    if (photosErr) {
      console.error('Error fetching gallery photos:', photosErr);
    } else {
      photos = rawPhotos || [];
    }

    // Fetch guest details for photo guest_ids
    const guestIds = photos.map((p: any) => p.guest_id).filter(Boolean);
    const guestMap = new Map<string, string>();

    if (guestIds.length > 0) {
      const { data: guestsData } = await (supabaseAdmin.from('guests') as any)
        .select('id, name')
        .in('id', guestIds);

      (guestsData || []).forEach((g: any) => {
        if (g.id) guestMap.set(g.id, g.name);
      });
    }

    // 3. Fetch Voice Messages for this Event
    const { data: voiceMessages, error: voiceErr } = await (supabaseAdmin.from('voice_messages') as any)
      .select('*')
      .eq('event_id', event.id)
      .eq('is_deleted', false);

    if (voiceErr) {
      console.error('Error fetching voice messages:', voiceErr);
    }

    // Map voice messages by guest_id for fast lookup
    const voiceMapByGuestId = new Map<string, any>();
    const voiceListWithoutGuest: any[] = [];

    (voiceMessages || []).forEach((v: any) => {
      if (v.guest_id) {
        voiceMapByGuestId.set(v.guest_id, v);
      } else {
        voiceListWithoutGuest.push(v);
      }
    });

    // 4. Map Photos to Gallery Items with Storage Public URLs
    const galleryItems = (photos || []).map((photo: any, index: number) => {
      let photoUrl = '';
      if (photo.final_photo_path) {
        if (photo.final_photo_path.startsWith('http://') || photo.final_photo_path.startsWith('https://')) {
          photoUrl = photo.final_photo_path;
        } else {
          const { data: pUrlData } = supabaseAdmin.storage
            .from('virtual-photobooth')
            .getPublicUrl(photo.final_photo_path);
          photoUrl = pUrlData?.publicUrl || '';
        }
      }

      const guestName = (photo.guest_id ? guestMap.get(photo.guest_id) : null) || photo.guests?.name || 'Tamu Istimewa';

      // Find matching voice message by guest_id or fallback
      let voiceUrl: string | null = null;
      let durationSeconds: number = 0;

      const voiceMsg = photo.guest_id
        ? voiceMapByGuestId.get(photo.guest_id)
        : voiceListWithoutGuest[index] || null;

      if (voiceMsg && voiceMsg.audio_path) {
        if (voiceMsg.audio_path.startsWith('http://') || voiceMsg.audio_path.startsWith('https://')) {
          voiceUrl = voiceMsg.audio_path;
        } else {
          const { data: vUrlData } = supabaseAdmin.storage
            .from('virtual-photobooth')
            .getPublicUrl(voiceMsg.audio_path);
          voiceUrl = vUrlData?.publicUrl || null;
        }
        durationSeconds = voiceMsg.duration_seconds || 5;
      }

      return {
        id: photo.id,
        guestId: photo.guest_id,
        guestName: guestName,
        photoUrl: photoUrl,
        voiceUrl: voiceUrl,
        durationSeconds: durationSeconds,
        createdAt: photo.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        name: event.name,
        monogram: event.monogram,
        subtitle: event.subtitle,
        slug: event.slug,
        event_date: event.event_date,
        coverPublicUrl: coverPublicUrl,
      },
      items: galleryItems,
    });
  } catch (err: any) {
    console.error('Error in gallery API:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}

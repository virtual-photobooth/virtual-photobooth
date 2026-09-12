import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateEventSlug, isEventExpired } from '@/lib/events/validate';
import { getStoragePublicUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    if (slugParam) {
      const result = await validateEventSlug(slugParam, { useAdmin: true });
      if (!result.isValid || !result.event) {
        return NextResponse.json({ success: false, message: 'Event tidak ditemukan atau sudah berakhir.' }, { status: 404 });
      }
      event = result.event;
    } else if (eventIdParam) {
      const { data } = await (supabaseAdmin.from('events') as any)
        .select('*')
        .eq('id', eventIdParam)
        .maybeSingle();
      if (!data || data.status !== 'active' || isEventExpired(data.event_date, data.voice_retention_days)) {
        return NextResponse.json({ success: false, message: 'Event tidak ditemukan atau sudah berakhir.' }, { status: 404 });
      }
      event = data;
    }

    if (!event) {
      return NextResponse.json({ success: false, message: 'Event tidak ditemukan.' }, { status: 404 });
    }

    // Resolve cover URL
    let coverPublicUrl: string | null = null;
    if (event.cover_path) {
      coverPublicUrl = getStoragePublicUrl(event.cover_path);
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
      .order('created_at', { ascending: false });

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
    const galleryItemsFromPhotos = (photos || []).map((photo: any, index: number) => {
      const photoUrl = photo.final_photo_path ? getStoragePublicUrl(photo.final_photo_path) : '';
      const guestName = (photo.guest_id ? guestMap.get(photo.guest_id) : null) || photo.guests?.name || 'Tamu Istimewa';

      // Find matching voice message by guest_id or fallback
      let voiceUrl: string | null = null;
      let durationSeconds: number = 0;

      const voiceMsg = photo.guest_id
        ? voiceMapByGuestId.get(photo.guest_id)
        : null;

      if (voiceMsg && voiceMsg.audio_path) {
        voiceUrl = getStoragePublicUrl(voiceMsg.audio_path);
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

    // 5. Include Standalone Voice Messages (voices recorded without photo)
    const coveredGuestIds = new Set(photos.map((p: any) => p.guest_id).filter(Boolean));
    const standaloneVoices = (voiceMessages || []).filter(
      (v: any) => v.guest_id && !coveredGuestIds.has(v.guest_id)
    );

    const standaloneItems = standaloneVoices.map((v: any) => {
      let voiceUrl: string | null = null;
      if (v.audio_path) {
        voiceUrl = getStoragePublicUrl(v.audio_path);
      }

      const guestName = (v.guest_id ? guestMap.get(v.guest_id) : null) || 'Tamu Spesial';

      return {
        id: `voice-${v.id}`,
        guestId: v.guest_id,
        guestName,
        photoUrl: coverPublicUrl || '/default-wedding-cover.png',
        voiceUrl,
        durationSeconds: v.duration_seconds || 5,
        createdAt: v.created_at,
      };
    });

    const allGalleryItems = [...galleryItemsFromPhotos, ...standaloneItems];

    return NextResponse.json(
      {
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
        items: allGalleryItems,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        },
      }
    );
  } catch (err: any) {
    console.error('Error in gallery API:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}

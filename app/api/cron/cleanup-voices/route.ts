import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Retention Cleanup Cron Endpoint
 * Automatically deletes photos, voice messages, and guest records
 * exactly 7 days after the event date (event_date + retention_days).
 */
export async function GET(request: Request) {
  return handleCleanup(request);
}

export async function POST(request: Request) {
  return handleCleanup(request);
}

async function handleCleanup(request: Request) {
  try {
    // Optional CRON_SECRET auth check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron execution' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();

    // -------------------------------------------------------------
    // 1. FETCH ALL EVENTS TO CHECK EXPIRATION (event_date + retention_days)
    // -------------------------------------------------------------
    const { data: events, error: eventsErr } = await (supabaseAdmin.from('events') as any)
      .select('id, name, event_date, voice_retention_days');

    if (eventsErr) {
      throw new Error(`Failed to fetch events: ${eventsErr.message}`);
    }

    let cleanedEventsCount = 0;
    let cleanedPhotoCount = 0;
    let cleanedVoiceCount = 0;
    let cleanedGuestCount = 0;

    const expiredEventIds: string[] = [];

    for (const evt of events || []) {
      if (!evt.event_date) continue;

      const retentionDays = evt.voice_retention_days ? Number(evt.voice_retention_days) : 7;
      const expiryDate = new Date(evt.event_date);
      expiryDate.setDate(expiryDate.getDate() + retentionDays);
      expiryDate.setHours(23, 59, 59, 999);

      // Check if current time has passed event_date + retentionDays
      if (now.getTime() > expiryDate.getTime()) {
        expiredEventIds.push(evt.id);
      }
    }

    // -------------------------------------------------------------
    // 2. CLEANUP EXPIRED EVENTS DATA
    // -------------------------------------------------------------
    if (expiredEventIds.length > 0) {
      // 2a. Photos cleanup
      const { data: expiredPhotos } = await (supabaseAdmin.from('photos') as any)
        .select('id, final_photo_path')
        .in('event_id', expiredEventIds);

      if (expiredPhotos && expiredPhotos.length > 0) {
        const photoPathsToDelete = expiredPhotos.map((p: any) => p.final_photo_path).filter(Boolean);
        if (photoPathsToDelete.length > 0) {
          await supabaseAdmin.storage.from('virtual-photobooth').remove(photoPathsToDelete);
        }
        await (supabaseAdmin.from('photos') as any).delete().in('event_id', expiredEventIds);
        cleanedPhotoCount += expiredPhotos.length;
      }

      // 2b. Voice messages cleanup
      const { data: expiredVoices } = await (supabaseAdmin.from('voice_messages') as any)
        .select('id, audio_path')
        .in('event_id', expiredEventIds);

      if (expiredVoices && expiredVoices.length > 0) {
        const voicePathsToDelete = expiredVoices.map((v: any) => v.audio_path).filter(Boolean);
        if (voicePathsToDelete.length > 0) {
          await supabaseAdmin.storage.from('virtual-photobooth').remove(voicePathsToDelete);
        }
        await (supabaseAdmin.from('voice_messages') as any).delete().in('event_id', expiredEventIds);
        cleanedVoiceCount += expiredVoices.length;
      }

      // 2c. Guests cleanup
      const { data: expiredGuests } = await (supabaseAdmin.from('guests') as any)
        .select('id')
        .in('event_id', expiredEventIds);

      if (expiredGuests && expiredGuests.length > 0) {
        await (supabaseAdmin.from('guests') as any).delete().in('event_id', expiredEventIds);
        cleanedGuestCount += expiredGuests.length;
      }

      cleanedEventsCount = expiredEventIds.length;
    }

    // -------------------------------------------------------------
    // 3. CLEANUP ANY INDIVIDUAL EXPIRED VOICE MESSAGES (expires_at <= now)
    // -------------------------------------------------------------
    const { data: orphanExpiredVoices } = await (supabaseAdmin.from('voice_messages') as any)
      .select('id, audio_path')
      .lte('expires_at', nowIso);

    if (orphanExpiredVoices && orphanExpiredVoices.length > 0) {
      const audioPaths = orphanExpiredVoices.map((v: any) => v.audio_path).filter(Boolean);
      const voiceIds = orphanExpiredVoices.map((v: any) => v.id);

      if (audioPaths.length > 0) {
        await supabaseAdmin.storage.from('virtual-photobooth').remove(audioPaths);
      }
      await (supabaseAdmin.from('voice_messages') as any).delete().in('id', voiceIds);
      cleanedVoiceCount += voiceIds.length;
    }

    return NextResponse.json({
      success: true,
      timestamp: nowIso,
      message: `Pembersihan retensi selesai: ${cleanedEventsCount} event kadaluarsa, ${cleanedPhotoCount} foto, ${cleanedVoiceCount} suara, dan ${cleanedGuestCount} tamu dihapus.`,
      cleanedEventsCount,
      cleanedPhotoCount,
      cleanedVoiceCount,
      cleanedGuestCount,
    });
  } catch (err: any) {
    console.error('Cron cleanup error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal menjalankan pembersihan retensi data' },
      { status: 500 }
    );
  }
}

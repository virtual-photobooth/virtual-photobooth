import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { purgeClientAndProfile } from '@/lib/supabase/storage-cleanup';
import { deleteMultipleFromStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Fetch all events
    const { data: events, error: eventsErr } = await (supabaseAdmin.from('events') as any)
      .select('id, name, client_id, event_date, voice_retention_days, status');

    if (eventsErr) {
      throw new Error(`Failed to fetch events: ${eventsErr.message}`);
    }

    let cleanedEventsCount = 0;
    let cleanedPhotoCount = 0;
    let cleanedVoiceCount = 0;
    let cleanedGuestCount = 0;
    let cleanedPrintRequestsCount = 0;
    let cleanedFramesCount = 0;
    let cleanedProfilesCount = 0;

    const expiredEventIds: string[] = [];
    const clientIdsToCheck = new Set<string>();

    for (const evt of events || []) {
      const isCompleted = evt.status === 'completed';
      let isExpired = false;

      if (evt.event_date) {
        const retentionDays = evt.voice_retention_days ? Number(evt.voice_retention_days) : 7;
        const expiryDate = new Date(evt.event_date);
        expiryDate.setDate(expiryDate.getDate() + retentionDays);
        expiryDate.setHours(23, 59, 59, 999);
        isExpired = now.getTime() > expiryDate.getTime();
      }

      if (isCompleted || isExpired) {
        expiredEventIds.push(evt.id);
        if (evt.client_id) {
          clientIdsToCheck.add(evt.client_id);
        }
      }
    }

    // 2. Clean up data of expired/completed events
    if (expiredEventIds.length > 0) {
      // 2a. Print requests
      try {
        const { data: delPR } = await (supabaseAdmin.from('print_requests') as any)
          .delete()
          .in('event_id', expiredEventIds)
          .select('id');
        cleanedPrintRequestsCount += (delPR || []).length;
      } catch (e) {
        console.warn('Print requests cleanup warning:', e);
      }

      // 2b. Photos
      const { data: expiredPhotos } = await (supabaseAdmin.from('photos') as any)
        .select('id, final_photo_path')
        .in('event_id', expiredEventIds);

      if (expiredPhotos && expiredPhotos.length > 0) {
        const photoPathsToDelete = expiredPhotos.map((p: any) => p.final_photo_path).filter(Boolean);
        if (photoPathsToDelete.length > 0) {
          await deleteMultipleFromStorage(photoPathsToDelete);
        }
        await (supabaseAdmin.from('photos') as any).delete().in('event_id', expiredEventIds);
        cleanedPhotoCount += expiredPhotos.length;
      }

      // 2c. Voice messages
      const { data: expiredVoices } = await (supabaseAdmin.from('voice_messages') as any)
        .select('id, audio_path')
        .in('event_id', expiredEventIds);

      if (expiredVoices && expiredVoices.length > 0) {
        const voicePathsToDelete = expiredVoices.map((v: any) => v.audio_path).filter(Boolean);
        if (voicePathsToDelete.length > 0) {
          await deleteMultipleFromStorage(voicePathsToDelete);
        }
        await (supabaseAdmin.from('voice_messages') as any).delete().in('event_id', expiredEventIds);
        cleanedVoiceCount += expiredVoices.length;
      }

      // 2d. Guests
      const { data: expiredGuests } = await (supabaseAdmin.from('guests') as any)
        .select('id')
        .in('event_id', expiredEventIds);

      if (expiredGuests && expiredGuests.length > 0) {
        await (supabaseAdmin.from('guests') as any).delete().in('event_id', expiredEventIds);
        cleanedGuestCount += expiredGuests.length;
      }

      // 2e. Event frames & cover cleanup
      try {
        const { data: expiredFrames } = await (supabaseAdmin.from('event_frames') as any)
          .select('id, frame_path')
          .in('event_id', expiredEventIds);

        const framePathsToDelete: string[] = [];
        (expiredFrames || []).forEach((f: any) => {
          if (f.frame_path) framePathsToDelete.push(f.frame_path);
        });

        const { data: expiredEventMeta } = await (supabaseAdmin.from('events') as any)
          .select('id, frame_path, cover_path')
          .in('id', expiredEventIds);

        (expiredEventMeta || []).forEach((e: any) => {
          if (e.frame_path) framePathsToDelete.push(e.frame_path);
          if (e.cover_path) framePathsToDelete.push(e.cover_path);
        });

        if (framePathsToDelete.length > 0) {
          await deleteMultipleFromStorage(framePathsToDelete);
        }

        await (supabaseAdmin.from('event_frames') as any).delete().in('event_id', expiredEventIds);
        await (supabaseAdmin.from('events') as any)
          .update({ frame_path: null, cover_path: null })
          .in('id', expiredEventIds);

        cleanedFramesCount += (expiredFrames || []).length;
      } catch (frameErr) {
        console.warn('Manual cleanup event_frames warning:', frameErr);
      }

      // 2f. Clients and profiles of completed/expired events
      for (const clientId of Array.from(clientIdsToCheck)) {
        try {
          const res = await purgeClientAndProfile(clientId);
          if (res && (res as any).deletedProfileId) {
            cleanedProfilesCount++;
          }
        } catch (e) {
          console.warn('Client purge error:', e);
        }
      }

      cleanedEventsCount = expiredEventIds.length;
    }

    // 3. Clean up orphaned clients, profiles, and orphaned frames
    try {
      const { data: currentActiveEvents } = await (supabaseAdmin.from('events') as any)
        .select('id, client_id, status')
        .neq('status', 'completed');

      const activeEventIds = new Set(
        (currentActiveEvents || [])
          .map((e: any) => e.id)
          .filter(Boolean)
      );

      const activeClientIds = new Set(
        (currentActiveEvents || [])
          .map((e: any) => e.client_id)
          .filter(Boolean)
      );

      // Clean up orphaned event_frames
      try {
        const { data: allFrames } = await (supabaseAdmin.from('event_frames') as any)
          .select('id, event_id, frame_path');

        const orphanFrameIds: string[] = [];
        const orphanFramePaths: string[] = [];

        for (const f of allFrames || []) {
          if (!activeEventIds.has(f.event_id)) {
            orphanFrameIds.push(f.id);
            if (f.frame_path) orphanFramePaths.push(f.frame_path);
          }
        }

        if (orphanFrameIds.length > 0) {
          if (orphanFramePaths.length > 0) {
            await deleteMultipleFromStorage(orphanFramePaths);
          }
          await (supabaseAdmin.from('event_frames') as any).delete().in('id', orphanFrameIds);
          cleanedFramesCount += orphanFrameIds.length;
        }
      } catch (fErr) {
        console.warn('Orphan event_frames cleanup warning:', fErr);
      }

      const { data: allClients } = await (supabaseAdmin.from('clients') as any)
        .select('id, user_id, contact_email');

      const activeProfileEmails = new Set<string>();
      const activeProfileUserIds = new Set<string>();

      for (const client of allClients || []) {
        if (!activeClientIds.has(client.id)) {
          const purgeRes = await purgeClientAndProfile(client.id, client.contact_email);
          if (purgeRes && (purgeRes as any).deletedProfileId) {
            cleanedProfilesCount++;
          }
        } else {
          if (client.contact_email) activeProfileEmails.add(client.contact_email.trim().toLowerCase());
          if (client.user_id) activeProfileUserIds.add(client.user_id);
        }
      }

      const { data: allClientProfiles } = await (supabaseAdmin.from('profiles') as any)
        .select('id, email, role')
        .eq('role', 'client');

      for (const prof of allClientProfiles || []) {
        const emailKey = prof.email?.trim().toLowerCase();
        if (!activeProfileUserIds.has(prof.id) && (!emailKey || !activeProfileEmails.has(emailKey))) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(prof.id);
          } catch (e) {
            console.warn('Orphan auth user delete warning:', e);
          }
          await (supabaseAdmin.from('profiles') as any)
            .delete()
            .eq('id', prof.id)
            .eq('role', 'client');
          cleanedProfilesCount++;
        }
      }
    } catch (e) {
      console.warn('Orphan cleanup error:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Pembersihan berhasil: ${cleanedEventsCount} event selesai/kadaluarsa, ${cleanedPhotoCount} foto, ${cleanedVoiceCount} suara, ${cleanedPrintRequestsCount} antrian cetak, ${cleanedFramesCount} frame event, ${cleanedGuestCount} tamu, dan ${cleanedProfilesCount} profil klien dibersihkan.`,
      cleanedEventsCount,
      cleanedPhotoCount,
      cleanedVoiceCount,
      cleanedPrintRequestsCount,
      cleanedFramesCount,
      cleanedGuestCount,
      cleanedProfilesCount,
    });
  } catch (err: any) {
    console.error('Manual admin cleanup error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal menjalankan pembersihan data' },
      { status: 500 }
    );
  }
}

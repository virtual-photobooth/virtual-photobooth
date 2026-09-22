import { createAdminClient } from './admin';
import {
  cleanStoragePath,
  deleteFromStorage,
  deleteMultipleFromStorage,
  listStorageFiles,
  getStorageBucketName,
} from '@/lib/storage';

export { cleanStoragePath };

/**
 * Recursively lists all file paths under a prefix in the configured storage.
 */
export async function listAllFilesRecursively(bucket: string, prefix: string): Promise<string[]> {
  return listStorageFiles(prefix, bucket);
}

/**
 * Completely purges a photo and all its associated guest data & voice message.
 * - Deletes the photo file from storage (Cloudflare R2 / Supabase)
 * - If linked to a guest:
 *   - Deletes any other photos for this guest from storage and database
 *   - Deletes voice messages for this guest from storage and database
 *   - Deletes the guest record
 * - If not linked to a guest: deletes photo row from database
 */
export async function purgePhotoCompletely(photoIdOrPath: string) {
  const supabaseAdmin = createAdminClient();
  const bucket = getStorageBucketName();
  const pathsToDelete = new Set<string>();

  // 1. Look up photo record by ID or final_photo_path
  let photo: any = null;
  const { data: byId } = await (supabaseAdmin.from('photos') as any)
    .select('id, guest_id, final_photo_path')
    .eq('id', photoIdOrPath)
    .maybeSingle();

  if (byId) {
    photo = byId;
  } else {
    const clean = cleanStoragePath(photoIdOrPath, bucket);
    const { data: byPath } = await (supabaseAdmin.from('photos') as any)
      .select('id, guest_id, final_photo_path')
      .eq('final_photo_path', clean)
      .maybeSingle();
    if (byPath) photo = byPath;
  }

  // If not found in DB, try to delete directly from storage if it is a file path
  if (!photo) {
    const clean = cleanStoragePath(photoIdOrPath, bucket);
    if (clean && clean.includes('/')) {
      await deleteFromStorage(clean, bucket);
    }
    return { success: true, message: 'File storage dihapus.' };
  }

  // Add primary photo path
  if (photo.final_photo_path) {
    pathsToDelete.add(cleanStoragePath(photo.final_photo_path, bucket));
  }

  const guestId = photo.guest_id;

  // 2. If photo is linked to a guest, cascade delete voice message & guest entry & all guest photos
  if (guestId) {
    // Find ALL photos for this guest
    const { data: guestPhotos } = await (supabaseAdmin.from('photos') as any)
      .select('id, final_photo_path')
      .eq('guest_id', guestId);

    (guestPhotos || []).forEach((p: any) => {
      if (p.final_photo_path) pathsToDelete.add(cleanStoragePath(p.final_photo_path, bucket));
    });

    // Find ALL voice messages for this guest
    const { data: guestVoices } = await (supabaseAdmin.from('voice_messages') as any)
      .select('id, audio_path')
      .eq('guest_id', guestId);

    (guestVoices || []).forEach((v: any) => {
      if (v.audio_path) pathsToDelete.add(cleanStoragePath(v.audio_path, bucket));
    });

    // Remove all files from Storage
    const allFiles = Array.from(pathsToDelete);
    if (allFiles.length > 0) {
      await deleteMultipleFromStorage(allFiles, bucket);
    }

    // Delete DB records in order: voice -> photos -> guest
    await (supabaseAdmin.from('voice_messages') as any).delete().eq('guest_id', guestId);
    await (supabaseAdmin.from('photos') as any).delete().eq('guest_id', guestId);
    await (supabaseAdmin.from('guests') as any).delete().eq('id', guestId);

    return {
      success: true,
      message: 'Foto, rekaman suara, dan data tamu berhasil dihapus.',
      deletedGuestId: guestId,
      deletedFiles: allFiles,
    };
  }

  // 3. If no guest_id, simply delete photo file & row
  const allFiles = Array.from(pathsToDelete);
  if (allFiles.length > 0) {
    await deleteMultipleFromStorage(allFiles, bucket);
  }
  await (supabaseAdmin.from('photos') as any).delete().eq('id', photo.id);

  return {
    success: true,
    message: 'Foto berhasil dihapus.',
    deletedFiles: allFiles,
  };
}

/**
 * Completely purges a guest and all their associated photos & voice messages.
 */
export async function purgeGuestCompletely(guestId: string) {
  const supabaseAdmin = createAdminClient();
  const bucket = getStorageBucketName();
  const pathsToDelete = new Set<string>();

  // 1. Fetch guest photos & voice messages
  const [{ data: guestPhotos }, { data: guestVoices }] = await Promise.all([
    (supabaseAdmin.from('photos') as any).select('id, final_photo_path').eq('guest_id', guestId),
    (supabaseAdmin.from('voice_messages') as any).select('id, audio_path').eq('guest_id', guestId),
  ]);

  (guestPhotos || []).forEach((p: any) => {
    if (p.final_photo_path) pathsToDelete.add(cleanStoragePath(p.final_photo_path, bucket));
  });

  (guestVoices || []).forEach((v: any) => {
    if (v.audio_path) pathsToDelete.add(cleanStoragePath(v.audio_path, bucket));
  });

  // 2. Remove files from storage
  const allFiles = Array.from(pathsToDelete);
  if (allFiles.length > 0) {
    await deleteMultipleFromStorage(allFiles, bucket);
  }

  // 3. Delete database records
  await Promise.all([
    (supabaseAdmin.from('photos') as any).delete().eq('guest_id', guestId),
    (supabaseAdmin.from('voice_messages') as any).delete().eq('guest_id', guestId),
  ]);
  await (supabaseAdmin.from('guests') as any).delete().eq('id', guestId);

  return {
    success: true,
    message: 'Data tamu, foto, dan pesan suara berhasil dihapus.',
    deletedFiles: allFiles,
  };
}

/**
 * Completely purges a single voice message from storage & database.
 */
export async function purgeVoiceCompletely(voiceId: string) {
  const supabaseAdmin = createAdminClient();
  const bucket = getStorageBucketName();

  const { data: voice } = await (supabaseAdmin.from('voice_messages') as any)
    .select('id, audio_path')
    .eq('id', voiceId)
    .maybeSingle();

  if (!voice) {
    return { success: false, message: 'Pesan suara tidak ditemukan.' };
  }

  if (voice.audio_path) {
    const clean = cleanStoragePath(voice.audio_path, bucket);
    await deleteFromStorage(clean, bucket);
  }

  await (supabaseAdmin.from('voice_messages') as any).delete().eq('id', voiceId);

  return { success: true, message: 'Pesan suara berhasil dihapus.' };
}

/**
 * Scans storage for an event and cleans up any orphaned files that have no database row.
 */
export async function cleanOrphanedMedia(eventId: string) {
  const supabaseAdmin = createAdminClient();
  const bucket = getStorageBucketName();

  const [{ data: dbPhotos }, { data: dbVoices }, { data: dbFrames }, { data: eventRow }] = await Promise.all([
    (supabaseAdmin.from('photos') as any).select('final_photo_path').eq('event_id', eventId),
    (supabaseAdmin.from('voice_messages') as any).select('audio_path').eq('event_id', eventId),
    (supabaseAdmin.from('event_frames') as any).select('frame_path').eq('event_id', eventId),
    (supabaseAdmin.from('events') as any).select('frame_path, cover_path').eq('id', eventId).maybeSingle(),
  ]);

  const activePhotoPaths = new Set(
    (dbPhotos || []).map((p: any) => cleanStoragePath(p.final_photo_path, bucket))
  );
  const activeVoicePaths = new Set(
    (dbVoices || []).map((v: any) => cleanStoragePath(v.audio_path, bucket))
  );
  const activeFramePaths = new Set(
    (dbFrames || []).map((f: any) => cleanStoragePath(f.frame_path, bucket))
  );
  if (eventRow?.frame_path) activeFramePaths.add(cleanStoragePath(eventRow.frame_path, bucket));
  if (eventRow?.cover_path) activeFramePaths.add(cleanStoragePath(eventRow.cover_path, bucket));

  const [storagePhotos, storageVoices, storageFrames] = await Promise.all([
    listStorageFiles(`events/${eventId}/photos`, bucket),
    listStorageFiles(`events/${eventId}/voices`, bucket),
    listStorageFiles(`events/${eventId}/frames`, bucket),
  ]);

  const orphanedPhotos = storagePhotos.filter((p) => !activePhotoPaths.has(p));
  const orphanedVoices = storageVoices.filter((v) => !activeVoicePaths.has(v));
  const orphanedFrames = storageFrames.filter((f) => !activeFramePaths.has(f));
  const allOrphans = [...orphanedPhotos, ...orphanedVoices, ...orphanedFrames];

  if (allOrphans.length > 0) {
    await deleteMultipleFromStorage(allOrphans, bucket);
  }

  return {
    success: true,
    cleanedCount: allOrphans.length,
    orphanedPhotos,
    orphanedVoices,
    orphanedFrames,
  };
}

/**
 * Safely purges a client record, its associated profile in public.profiles,
 * and its Supabase auth.users account (ONLY IF role === 'client', NEVER deletes 'owner').
 */
export async function purgeClientAndProfile(clientId: string, clientEmail?: string | null) {
  const supabaseAdmin = createAdminClient();

  try {
    let email = clientEmail;
    let userId: string | null = null;

    const { data: clientRecord } = await (supabaseAdmin.from('clients') as any)
      .select('id, user_id, contact_email')
      .eq('id', clientId)
      .maybeSingle();

    if (clientRecord) {
      email = email || clientRecord.contact_email;
      userId = userId || clientRecord.user_id;
    }

    // Check if this client has any OTHER active events
    const { data: otherEvents } = await (supabaseAdmin.from('events') as any)
      .select('id, status')
      .eq('client_id', clientId)
      .neq('status', 'completed');

    if (otherEvents && otherEvents.length > 0) {
      // Client still has other active events, do not delete client account
      return { skipped: true, reason: 'Client has other active events' };
    }

    // 1. Delete client row from public.clients
    await (supabaseAdmin.from('clients') as any).delete().eq('id', clientId);

    // 2. Identify profile to delete
    let profileToDelete: any = null;

    if (userId) {
      const { data: p } = await (supabaseAdmin.from('profiles') as any)
        .select('id, email, role')
        .eq('id', userId)
        .maybeSingle();
      if (p) profileToDelete = p;
    }

    if (!profileToDelete && email) {
      const { data: p } = await (supabaseAdmin.from('profiles') as any)
        .select('id, email, role')
        .ilike('email', email.trim().toLowerCase())
        .maybeSingle();
      if (p) profileToDelete = p;
    }

    // STRICT SAFETY CHECK: Never delete owner profiles!
    if (profileToDelete && profileToDelete.role === 'client') {
      // Delete user from Supabase Auth
      try {
        await supabaseAdmin.auth.admin.deleteUser(profileToDelete.id);
      } catch (authErr: any) {
        console.warn('Auth user delete warning:', authErr?.message);
      }

      // Delete from public.profiles
      await (supabaseAdmin.from('profiles') as any)
        .delete()
        .eq('id', profileToDelete.id)
        .eq('role', 'client');

      return { success: true, deletedProfileId: profileToDelete.id, email: profileToDelete.email };
    }

    return { success: true, clientDeleted: true };
  } catch (err: any) {
    console.error('Error in purgeClientAndProfile:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Completely purges all data of a completed event (photos, voices, guests, print requests, client profile)
 * while optionally retaining the event row itself as 'completed'.
 */
export async function purgeCompletedEventData(eventId: string) {
  const supabaseAdmin = createAdminClient();
  const bucket = getStorageBucketName();
  const pathsToDelete = new Set<string>();

  // Fetch client_id, frame_path, and cover_path
  let clientId: string | null = null;
  try {
    const { data: evt } = await (supabaseAdmin.from('events') as any)
      .select('id, client_id, frame_path, cover_path')
      .eq('id', eventId)
      .maybeSingle();
    clientId = evt?.client_id || null;
    if (evt?.frame_path) pathsToDelete.add(cleanStoragePath(evt.frame_path, bucket));
    if (evt?.cover_path) pathsToDelete.add(cleanStoragePath(evt.cover_path, bucket));
  } catch (e) {
    // silent
  }

  // Collect event_frames storage files
  try {
    const { data: frames } = await (supabaseAdmin.from('event_frames') as any)
      .select('frame_path')
      .eq('event_id', eventId);
    (frames || []).forEach((f: any) => {
      if (f.frame_path) pathsToDelete.add(cleanStoragePath(f.frame_path, bucket));
    });
  } catch (e) {}

  // Also collect any remaining storage files under events/${eventId}/frames and events/${eventId}/frame
  try {
    const frameStorageFiles = await listStorageFiles(`events/${eventId}/frames`, bucket);
    frameStorageFiles.forEach((p) => pathsToDelete.add(p));
    const singleFrameStorageFiles = await listStorageFiles(`events/${eventId}/frame`, bucket);
    singleFrameStorageFiles.forEach((p) => pathsToDelete.add(p));
  } catch (e) {}

  // Collect photo and voice storage files
  try {
    const { data: photos } = await (supabaseAdmin.from('photos') as any)
      .select('final_photo_path')
      .eq('event_id', eventId);
    (photos || []).forEach((p: any) => {
      if (p.final_photo_path) pathsToDelete.add(cleanStoragePath(p.final_photo_path, bucket));
    });
  } catch (e) {}

  try {
    const { data: voices } = await (supabaseAdmin.from('voice_messages') as any)
      .select('audio_path')
      .eq('event_id', eventId);
    (voices || []).forEach((v: any) => {
      if (v.audio_path) pathsToDelete.add(cleanStoragePath(v.audio_path, bucket));
    });
  } catch (e) {}

  // Delete storage files
  const allFiles = Array.from(pathsToDelete);
  if (allFiles.length > 0) {
    await deleteMultipleFromStorage(allFiles, bucket);
  }

  // Delete print_requests, photos, voice_messages, guests, and event_frames
  try {
    await (supabaseAdmin.from('print_requests') as any).delete().eq('event_id', eventId);
  } catch (e) {}
  await (supabaseAdmin.from('photos') as any).delete().eq('event_id', eventId);
  await (supabaseAdmin.from('voice_messages') as any).delete().eq('event_id', eventId);
  await (supabaseAdmin.from('guests') as any).delete().eq('event_id', eventId);
  try {
    await (supabaseAdmin.from('event_frames') as any).delete().eq('event_id', eventId);
  } catch (e) {}

  // Clear frame_path and cover_path on events row
  try {
    await (supabaseAdmin.from('events') as any)
      .update({ frame_path: null, cover_path: null })
      .eq('id', eventId);
  } catch (e) {}

  // Clean up client and profile if no other active events
  if (clientId) {
    await purgeClientAndProfile(clientId);
  }

  return { success: true, deletedFilesCount: allFiles.length };
}

/**
 * Completely purges an entire event from Storage and Database.
 */
export async function purgeEventCompletely(eventId: string) {
  const supabaseAdmin = createAdminClient();
  const bucket = getStorageBucketName();

  // 0. Fetch event and client info before deletion
  let clientId: string | null = null;
  try {
    const { data: evt } = await (supabaseAdmin.from('events') as any)
      .select('id, client_id')
      .eq('id', eventId)
      .maybeSingle();
    clientId = evt?.client_id || null;
  } catch (e) {
    // silent
  }

  // 1. Collect all known paths from database before deleting rows
  const pathsToDelete = new Set<string>();

  try {
    const { data: photos } = await (supabaseAdmin.from('photos') as any)
      .select('final_photo_path')
      .eq('event_id', eventId);
    (photos || []).forEach((p: any) => {
      if (p.final_photo_path) {
        pathsToDelete.add(cleanStoragePath(p.final_photo_path, bucket));
      }
    });
  } catch (e) {
    // silent
  }

  try {
    const { data: voices } = await (supabaseAdmin.from('voice_messages') as any)
      .select('audio_path')
      .eq('event_id', eventId);
    (voices || []).forEach((v: any) => {
      if (v.audio_path) {
        pathsToDelete.add(cleanStoragePath(v.audio_path, bucket));
      }
    });
  } catch (e) {
    // silent
  }

  try {
    const { data: frames } = await (supabaseAdmin.from('event_frames') as any)
      .select('frame_path')
      .eq('event_id', eventId);
    (frames || []).forEach((f: any) => {
      if (f.frame_path) {
        pathsToDelete.add(cleanStoragePath(f.frame_path, bucket));
      }
    });
  } catch (e) {
    // silent
  }

  try {
    const { data: eventData } = await (supabaseAdmin.from('events') as any)
      .select('frame_path, cover_path')
      .eq('id', eventId)
      .maybeSingle();
    if (eventData?.frame_path) {
      pathsToDelete.add(cleanStoragePath(eventData.frame_path, bucket));
    }
    if (eventData?.cover_path) {
      pathsToDelete.add(cleanStoragePath(eventData.cover_path, bucket));
    }
  } catch (e) {
    // silent
  }

  // 2. Recursively find ALL files under events/${eventId} in storage
  const storageFiles = await listStorageFiles(`events/${eventId}`, bucket);
  storageFiles.forEach((p) => pathsToDelete.add(p));

  // 3. Remove all files from Storage
  const allFilesList = Array.from(pathsToDelete);
  if (allFilesList.length > 0) {
    await deleteMultipleFromStorage(allFilesList, bucket);
  }

  // 4. Delete all database records in cascade order
  try {
    await (supabaseAdmin.from('print_requests') as any).delete().eq('event_id', eventId);
  } catch (e) {
    // silent
  }
  await (supabaseAdmin.from('photos') as any).delete().eq('event_id', eventId);
  await (supabaseAdmin.from('voice_messages') as any).delete().eq('event_id', eventId);
  await (supabaseAdmin.from('guests') as any).delete().eq('event_id', eventId);
  try {
    await (supabaseAdmin.from('event_frames') as any).delete().eq('event_id', eventId);
  } catch (e) {
    // silent
  }
  const { error: eventDeleteErr } = await (supabaseAdmin.from('events') as any).delete().eq('id', eventId);

  if (eventDeleteErr) {
    throw eventDeleteErr;
  }

  // 5. Purge client and client profile/auth.users account
  if (clientId) {
    await purgeClientAndProfile(clientId);
  }

  return { success: true, deletedFilesCount: allFilesList.length };
}

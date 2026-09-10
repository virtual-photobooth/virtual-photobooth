import { createAdminClient } from './admin';

/**
 * Cleans a file path by removing full URLs, leading slashes, and redundant bucket prefixes.
 */
export function cleanStoragePath(pathOrUrl: string, bucket = 'virtual-photobooth'): string {
  if (!pathOrUrl) return '';
  let p = pathOrUrl.trim();
  if (p.startsWith('http://') || p.startsWith('https://')) {
    try {
      const url = new URL(p);
      p = url.pathname;
    } catch {
      // ignore
    }
  }
  const bucketPrefix = `/storage/v1/object/public/${bucket}/`;
  if (p.includes(bucketPrefix)) {
    p = p.substring(p.indexOf(bucketPrefix) + bucketPrefix.length);
  }
  if (p.startsWith(`${bucket}/`)) {
    p = p.substring(bucket.length + 1);
  }
  if (p.startsWith('/')) {
    p = p.substring(1);
  }
  return p;
}

/**
 * Recursively lists all file paths under a prefix in a given Supabase Storage bucket.
 */
export async function listAllFilesRecursively(bucket: string, prefix: string): Promise<string[]> {
  const supabaseAdmin = createAdminClient();
  let results: string[] = [];

  const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix);
  if (error || !data) return results;

  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    // In Supabase storage, folders have item.id === null
    if (item.id === null) {
      const sub = await listAllFilesRecursively(bucket, fullPath);
      results = results.concat(sub);
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Completely purges a photo and all its associated guest data & voice message.
 * - Deletes the photo file from storage
 * - If linked to a guest:
 *   - Deletes any other photos for this guest from storage and database
 *   - Deletes voice messages for this guest from storage and database
 *   - Deletes the guest record
 * - If not linked to a guest: deletes photo row from database
 */
export async function purgePhotoCompletely(photoIdOrPath: string) {
  const supabaseAdmin = createAdminClient();
  const bucket = 'virtual-photobooth';
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
      await supabaseAdmin.storage.from(bucket).remove([clean]);
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

    // Remove all files from Supabase Storage
    const allFiles = Array.from(pathsToDelete);
    if (allFiles.length > 0) {
      await supabaseAdmin.storage.from(bucket).remove(allFiles);
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
    await supabaseAdmin.storage.from(bucket).remove(allFiles);
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
  const bucket = 'virtual-photobooth';
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
    await supabaseAdmin.storage.from(bucket).remove(allFiles);
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
  const bucket = 'virtual-photobooth';

  const { data: voice } = await (supabaseAdmin.from('voice_messages') as any)
    .select('id, audio_path')
    .eq('id', voiceId)
    .maybeSingle();

  if (voice?.audio_path) {
    const clean = cleanStoragePath(voice.audio_path, bucket);
    await supabaseAdmin.storage.from(bucket).remove([clean]);
  }

  await (supabaseAdmin.from('voice_messages') as any).delete().eq('id', voiceId);

  return {
    success: true,
    message: 'Pesan suara berhasil dihapus.',
  };
}

/**
 * Scans storage for an event and cleans up any orphaned files that have no database row.
 */
export async function cleanOrphanedMedia(eventId: string) {
  const supabaseAdmin = createAdminClient();
  const bucket = 'virtual-photobooth';

  const [{ data: dbPhotos }, { data: dbVoices }] = await Promise.all([
    (supabaseAdmin.from('photos') as any).select('final_photo_path').eq('event_id', eventId),
    (supabaseAdmin.from('voice_messages') as any).select('audio_path').eq('event_id', eventId),
  ]);

  const activePhotoPaths = new Set(
    (dbPhotos || []).map((p: any) => cleanStoragePath(p.final_photo_path, bucket))
  );
  const activeVoicePaths = new Set(
    (dbVoices || []).map((v: any) => cleanStoragePath(v.audio_path, bucket))
  );

  const [storagePhotos, storageVoices] = await Promise.all([
    listAllFilesRecursively(bucket, `events/${eventId}/photos`),
    listAllFilesRecursively(bucket, `events/${eventId}/voices`),
  ]);

  const orphanedPhotos = storagePhotos.filter((p) => !activePhotoPaths.has(p));
  const orphanedVoices = storageVoices.filter((v) => !activeVoicePaths.has(v));
  const allOrphans = [...orphanedPhotos, ...orphanedVoices];

  if (allOrphans.length > 0) {
    for (let i = 0; i < allOrphans.length; i += 100) {
      await supabaseAdmin.storage.from(bucket).remove(allOrphans.slice(i, i + 100));
    }
  }

  return {
    success: true,
    cleanedCount: allOrphans.length,
    orphanedPhotos,
    orphanedVoices,
  };
}

/**
 * Completely purges an entire event from Supabase Storage and Database.
 */
export async function purgeEventCompletely(eventId: string) {
  const supabaseAdmin = createAdminClient();
  const bucket = 'virtual-photobooth';

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
  const storageFiles = await listAllFilesRecursively(bucket, `events/${eventId}`);
  storageFiles.forEach((p) => pathsToDelete.add(p));

  // 3. Remove all files from Supabase Storage in chunks of 100
  const allFilesList = Array.from(pathsToDelete);
  if (allFilesList.length > 0) {
    for (let i = 0; i < allFilesList.length; i += 100) {
      const chunk = allFilesList.slice(i, i + 100);
      await supabaseAdmin.storage.from(bucket).remove(chunk);
    }
  }

  // 4. Delete all database records in cascade order
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

  return { success: true, deletedFilesCount: allFilesList.length };
}

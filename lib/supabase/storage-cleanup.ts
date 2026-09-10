import { createAdminClient } from './admin';

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
 * Completely purges an entire event from Supabase Storage and Database.
 * - Deletes all files under events/${eventId}/... in storage
 * - Deletes any specific photo, voice, frame, and cover paths
 * - Deletes all photos rows
 * - Deletes all voice_messages rows
 * - Deletes all guests rows
 * - Deletes all event_frames rows (if any)
 * - Deletes the event row
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
      if (p.final_photo_path && !p.final_photo_path.startsWith('http')) {
        pathsToDelete.add(p.final_photo_path);
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
      if (v.audio_path && !v.audio_path.startsWith('http')) {
        pathsToDelete.add(v.audio_path);
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
    if (eventData?.frame_path && !eventData.frame_path.startsWith('http')) {
      pathsToDelete.add(eventData.frame_path);
    }
    if (eventData?.cover_path && !eventData.cover_path.startsWith('http')) {
      pathsToDelete.add(eventData.cover_path);
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

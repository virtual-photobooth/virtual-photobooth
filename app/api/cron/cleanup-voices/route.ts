import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    // Optional CRON_SECRET auth check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron execution' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const nowIso = new Date().toISOString();

    // Calculate 7-day expiration threshold
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoIso = sevenDaysAgo.toISOString();

    // -------------------------------------------------------------
    // 1. CLEANUP EXPIRED PHOTOS (Older than 7 days)
    // -------------------------------------------------------------
    let cleanedPhotoCount = 0;
    const { data: expiredPhotos, error: photoFetchErr } = await (supabaseAdmin.from('photos') as any)
      .select('id, photo_path')
      .lt('created_at', sevenDaysAgoIso);

    if (!photoFetchErr && expiredPhotos && expiredPhotos.length > 0) {
      const photoPathsToDelete = expiredPhotos.map((p: any) => p.photo_path).filter(Boolean);
      const photoIdsToDelete = expiredPhotos.map((p: any) => p.id);

      if (photoPathsToDelete.length > 0) {
        await supabaseAdmin.storage.from('virtual-photobooth').remove(photoPathsToDelete);
      }

      await (supabaseAdmin.from('photos') as any).delete().in('id', photoIdsToDelete);
      cleanedPhotoCount = photoIdsToDelete.length;
    }

    // -------------------------------------------------------------
    // 2. CLEANUP EXPIRED VOICE MESSAGES (Older than 7 days)
    // -------------------------------------------------------------
    let cleanedVoiceCount = 0;
    const { data: expiredVoices, error: fetchErr } = await (supabaseAdmin.from('voice_messages') as any)
      .select('id, audio_path')
      .lte('expires_at', nowIso)
      .eq('is_deleted', false);

    if (!fetchErr && expiredVoices && expiredVoices.length > 0) {
      const voicePathsToDelete = expiredVoices.map((v: any) => v.audio_path).filter(Boolean);
      const voiceIdsToMark = expiredVoices.map((v: any) => v.id);

      if (voicePathsToDelete.length > 0) {
        await supabaseAdmin.storage.from('virtual-photobooth').remove(voicePathsToDelete);
      }

      await (supabaseAdmin.from('voice_messages') as any)
        .update({ is_deleted: true })
        .in('id', voiceIdsToMark);

      cleanedVoiceCount = voiceIdsToMark.length;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${cleanedPhotoCount} expired photos & ${cleanedVoiceCount} expired voice messages.`,
      cleanedPhotoCount,
      cleanedVoiceCount,
    });
  } catch (err: any) {
    console.error('Cron cleanup error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to execute retention cleanup' },
      { status: 500 }
    );
  }
}

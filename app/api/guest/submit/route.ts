import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      eventId,
      guestName,
      photoBase64,
      voiceBase64,
      voiceMimeType,
      durationSeconds,
    } = body;

    if (!eventId) {
      return NextResponse.json({ success: false, message: 'Event ID wajib diisi.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const finalGuestName = (guestName || 'Tamu Istimewa').trim();

    // 1. Insert Guest into `guests` table
    let newGuest: any = null;

    const { data: insertedGuest, error: err1 } = await (supabaseAdmin.from('guests') as any)
      .insert({
        event_id: eventId,
        name: finalGuestName,
      })
      .select()
      .single();

    if (!err1 && insertedGuest) {
      newGuest = insertedGuest;
    } else {
      const { data: fbGuest } = await (supabaseAdmin.from('guests') as any)
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fbGuest) {
        newGuest = fbGuest;
      }
    }

    const guestId = newGuest?.id || null;
    let photoPath = null;
    let voicePath = null;

    // 2. Process & Upload Photo to Storage and `photos` table
    if (photoBase64) {
      try {
        const rawPhotoStr = String(photoBase64);
        const base64Data = rawPhotoStr.includes(',') ? rawPhotoStr.split(',')[1] : rawPhotoStr;
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `events/${eventId}/photos/photo_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

        const { error: uploadPhotoErr } = await supabaseAdmin.storage
          .from('virtual-photobooth')
          .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true });

        if (!uploadPhotoErr) {
          photoPath = filename;
        } else {
          console.error('Upload photo storage error:', uploadPhotoErr);
        }

        await (supabaseAdmin.from('photos') as any).insert({
          event_id: eventId,
          guest_id: guestId,
          final_photo_path: photoPath || filename,
        });
      } catch (pErr) {
        console.error('Photo processing error:', pErr);
      }
    }

    // 3. Process & Upload Voice Audio to Storage and `voice_messages` table
    if (voiceBase64) {
      try {
        const rawVoiceStr = String(voiceBase64);
        const base64Audio = rawVoiceStr.includes(',') ? rawVoiceStr.split(',')[1] : rawVoiceStr;
        const audioBuffer = Buffer.from(base64Audio, 'base64');

        // Clean MIME type to standard audio format (strip codec parameters like ;codecs=opus)
        const rawMime = (voiceMimeType || 'audio/webm').toLowerCase();
        const cleanMime = rawMime.split(';')[0].trim() || 'audio/webm';
        const isMp4 = cleanMime.includes('mp4') || cleanMime.includes('aac') || cleanMime.includes('m4a');
        const ext = isMp4 ? 'm4a' : 'webm';
        const filename = `events/${eventId}/voices/voice_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

        const { error: uploadVoiceErr } = await supabaseAdmin.storage
          .from('virtual-photobooth')
          .upload(filename, audioBuffer, { contentType: cleanMime, upsert: true });

        if (uploadVoiceErr) {
          console.error('Upload voice storage error:', uploadVoiceErr.message);
        } else {
          voicePath = filename;
        }

        // Calculate voice retention expires_at date (default 7 days)
        let retentionDays = 7;
        const { data: eventData } = await (supabaseAdmin.from('events') as any)
          .select('voice_retention_days')
          .eq('id', eventId)
          .maybeSingle();

        if (eventData?.voice_retention_days) {
          retentionDays = Number(eventData.voice_retention_days);
        }

        const expiresAtDate = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

        const { error: insertVoiceErr } = await (supabaseAdmin.from('voice_messages') as any).insert({
          event_id: eventId,
          guest_id: guestId,
          audio_path: voicePath || filename,
          duration_seconds: durationSeconds ? Number(durationSeconds) : 5,
          expires_at: expiresAtDate,
        });

        if (insertVoiceErr) {
          console.error('Insert voice message DB error:', insertVoiceErr.message);
        }
      } catch (vErr) {
        console.error('Voice processing error:', vErr);
      }
    }

    return NextResponse.json({
      success: true,
      guestId,
      photoPath,
      voicePath,
    });
  } catch (err: any) {
    console.error('Error submitting guestbook:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}

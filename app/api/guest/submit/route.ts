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

    // STEP 0: Ensure Event is ACTIVE & is_voice_enabled=true FIRST so RLS allows inserts into guests, photos, and voice_messages
    try {
      await (supabaseAdmin.from('events') as any)
        .update({ status: 'active', is_voice_enabled: true })
        .eq('id', eventId);
    } catch (e) {
      console.warn('Failed to update event status to active:', e);
    }

    // 1. Insert Guest into `guests` table
    let newGuest: any = null;

    const { data: insertedGuest, error: err1 } = await (supabaseAdmin.from('guests') as any)
      .insert({
        event_id: eventId,
        name: finalGuestName,
      })
      .select()
      .single();

    if (err1) {
      console.error('Insert guest DB error:', err1.message);
    }

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
    let voiceErrorMsg: string | null = null;

    let photoErrorMsg: string | null = null;

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
          photoErrorMsg = `Storage upload error: ${uploadPhotoErr.message}`;
        }

        const { error: insertPhotoErr } = await (supabaseAdmin.from('photos') as any).insert({
          event_id: eventId,
          guest_id: guestId,
          final_photo_path: photoPath || filename,
        });

        if (insertPhotoErr) {
          console.error('Insert photo DB error:', insertPhotoErr.message);
          photoErrorMsg = `DB insert error: ${insertPhotoErr.message}`;
        }
      } catch (pErr: any) {
        console.error('Photo processing error:', pErr);
        photoErrorMsg = pErr.message || 'Unknown photo error';
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
          voiceErrorMsg = `Storage upload error: ${uploadVoiceErr.message}`;
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
          voiceErrorMsg = `DB insert error: ${insertVoiceErr.message}`;
        }
      } catch (vErr: any) {
        console.error('Voice processing error:', vErr);
        voiceErrorMsg = vErr.message || 'Unknown voice error';
      }
    }

    return NextResponse.json({
      success: true,
      guestId,
      photoPath,
      voicePath,
      photoError: photoErrorMsg,
      voiceError: voiceErrorMsg,
    });
  } catch (err: any) {
    console.error('Error submitting guestbook:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}

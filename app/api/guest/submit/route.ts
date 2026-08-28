import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      eventId,
      guestName,
      wishes,
      photoBase64,
      voiceBase64,
      voiceMimeType,
      durationSeconds,
    } = body;

    if (!eventId) {
      return NextResponse.json({ success: false, message: 'Event ID wajib diisi.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. Insert Guest into `guests` table
    const { data: newGuest, error: guestErr } = await (supabaseAdmin.from('guests') as any)
      .insert({
        event_id: eventId,
        name: (guestName || 'Tamu Istimewa').trim(),
        wishes: (wishes || '').trim() || null,
      })
      .select()
      .single();

    if (guestErr || !newGuest) {
      console.error('Error inserting guest:', guestErr);
      throw new Error(guestErr?.message || 'Gagal menyimpan data tamu');
    }

    const guestId = newGuest.id;
    let photoPath = null;
    let voicePath = null;

    // 2. Process & Upload Photo to Storage and `photos` table
    if (photoBase64) {
      try {
        const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `events/${eventId}/photos/photo_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

        const { error: uploadPhotoErr } = await supabaseAdmin.storage
          .from('virtual-photobooth')
          .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true });

        if (!uploadPhotoErr) {
          photoPath = filename;
          await (supabaseAdmin.from('photos') as any).insert({
            event_id: eventId,
            guest_id: guestId,
            final_photo_path: filename,
            raw_photo_paths: [],
          });
        } else {
          console.error('Upload photo storage error:', uploadPhotoErr);
        }
      } catch (pErr) {
        console.error('Photo processing error:', pErr);
      }
    }

    // 3. Process & Upload Voice Audio to Storage and `voice_messages` table
    if (voiceBase64) {
      try {
        const base64Audio = voiceBase64.replace(/^data:audio\/\w+;base64,/, '');
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        const mime = voiceMimeType || 'audio/mp4';
        const isMp4 = mime.includes('mp4') || mime.includes('aac') || mime.includes('m4a');
        const ext = isMp4 ? 'm4a' : 'webm';
        const filename = `events/${eventId}/voices/voice_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

        const { error: uploadVoiceErr } = await supabaseAdmin.storage
          .from('virtual-photobooth')
          .upload(filename, audioBuffer, { contentType: mime, upsert: true });

        if (!uploadVoiceErr) {
          voicePath = filename;
          await (supabaseAdmin.from('voice_messages') as any).insert({
            event_id: eventId,
            guest_id: guestId,
            audio_path: filename,
            duration_seconds: durationSeconds ? Number(durationSeconds) : 0,
            is_deleted: false,
          });
        } else {
          console.error('Upload voice storage error:', uploadVoiceErr);
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

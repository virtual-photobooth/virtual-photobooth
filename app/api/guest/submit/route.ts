import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadToStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      action,
      guestId: inputGuestId,
      photoId: inputPhotoId,
      eventId,
      guestName,
      selectedFrameId,
      selected_frame_id,
      photoBase64,
      voiceBase64,
      voiceMimeType,
      durationSeconds,
    } = body;

    const supabaseAdmin = createAdminClient();

    // 0. HANDLE RETAKE / DELETE DRAFT ACTION
    if (action === 'retake' || action === 'delete') {
      if (inputPhotoId) {
        await (supabaseAdmin.from('photos') as any)
          .delete()
          .eq('id', inputPhotoId);
      }
      if (inputGuestId) {
        await (supabaseAdmin.from('guests') as any)
          .delete()
          .eq('id', inputGuestId);
      }
      return NextResponse.json({ success: true, message: 'Draft photo removed for retake' });
    }

    if (!eventId) {
      return NextResponse.json({ success: false, message: 'Event ID wajib diisi.' }, { status: 400 });
    }

    // Validate selectedFrameId if provided
    const targetFrameId = (selectedFrameId || selected_frame_id || null)?.toString().trim() || null;
    if (targetFrameId) {
      const { data: frameRecord, error: frameErr } = await (supabaseAdmin.from('event_frames') as any)
        .select('id, event_id')
        .eq('id', targetFrameId)
        .maybeSingle();

      if (frameErr || !frameRecord) {
        return NextResponse.json(
          { success: false, message: 'Frame yang dipilih tidak ditemukan.' },
          { status: 400 }
        );
      }

      if (frameRecord.event_id !== eventId) {
        return NextResponse.json(
          { success: false, message: 'Frame yang dipilih tidak valid untuk event ini.' },
          { status: 400 }
        );
      }
    }

    // STEP 0: Ensure Event is ACTIVE & is_voice_enabled=true FIRST so RLS allows inserts into guests, photos, and voice_messages
    try {
      await (supabaseAdmin.from('events') as any)
        .update({ status: 'active', is_voice_enabled: true })
        .eq('id', eventId);
    } catch (e) {
      console.warn('Failed to update event status to active:', e);
    }

    let guestId = inputGuestId || null;
    let photoId = inputPhotoId || null;
    let photoPath: string | null = null;
    let voicePath: string | null = null;
    let voiceErrorMsg: string | null = null;
    let photoErrorMsg: string | null = null;

    // 1. UPDATE EXISTING GUEST OR INSERT NEW GUEST
    if (guestId) {
      if (guestName && guestName.trim()) {
        await (supabaseAdmin.from('guests') as any)
          .update({ name: guestName.trim() })
          .eq('id', guestId);
      }
    } else {
      const finalGuestName = (guestName && guestName.trim()) ? guestName.trim() : 'Tamu Undangan';
      const { data: insertedGuest, error: err1 } = await (supabaseAdmin.from('guests') as any)
        .insert({
          event_id: eventId,
          name: finalGuestName,
        })
        .select()
        .single();

      if (err1) {
        console.error('Insert guest DB error:', err1.message);
        if (err1.message.includes('row-level security') || err1.message.includes('RLS')) {
          return NextResponse.json(
            { success: false, message: 'Database RLS policy rejected guest insert. Silakan jalankan script SQL perbaikan RLS di Supabase SQL Editor.' },
            { status: 500 }
          );
        }
      }

      if (!err1 && insertedGuest) {
        guestId = insertedGuest.id;
      }
    }

    // 2. Process & Upload Photo to Storage and `photos` table
    if (photoBase64) {
      try {
        const rawPhotoStr = String(photoBase64);
        const isPng = rawPhotoStr.startsWith('data:image/png');
        const ext = isPng ? 'png' : 'jpg';
        const mimeType = isPng ? 'image/png' : 'image/jpeg';
        const base64Data = rawPhotoStr.includes(',') ? rawPhotoStr.split(',')[1] : rawPhotoStr;
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `events/${eventId}/photos/photo_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

        const uploadRes = await uploadToStorage(filename, buffer, mimeType);
        if (uploadRes.success) {
          photoPath = filename;
        }

        if (photoId) {
          // Update existing photo record (e.g. frame switched in preview)
          const { error: updatePhotoErr } = await (supabaseAdmin.from('photos') as any)
            .update({
              selected_frame_id: targetFrameId,
              final_photo_path: photoPath || filename,
            })
            .eq('id', photoId);

          if (updatePhotoErr) {
            console.error('Update photo DB error:', updatePhotoErr.message);
            photoErrorMsg = `DB update error: ${updatePhotoErr.message}`;
          }
        } else {
          // Insert new photo record
          const { data: insertedPhoto, error: insertPhotoErr } = await (supabaseAdmin.from('photos') as any)
            .insert({
              event_id: eventId,
              guest_id: guestId,
              selected_frame_id: targetFrameId,
              final_photo_path: photoPath || filename,
            })
            .select('id')
            .single();

          if (insertPhotoErr) {
            console.error('Insert photo DB error:', insertPhotoErr.message);
            photoErrorMsg = `DB insert error: ${insertPhotoErr.message}`;
            if (insertPhotoErr.message.includes('row-level security') || insertPhotoErr.message.includes('RLS')) {
              return NextResponse.json(
                { success: false, message: 'Database RLS policy rejected photo insert. Silakan jalankan script SQL perbaikan RLS di Supabase SQL Editor.' },
                { status: 500 }
              );
            }
          } else if (insertedPhoto) {
            photoId = insertedPhoto.id;
          }
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

        const uploadVoiceRes = await uploadToStorage(filename, audioBuffer, cleanMime);
        if (uploadVoiceRes.success) {
          voicePath = filename;
        }

        // Calculate retention expires_at date based on event_date + 7 days
        let retentionDays = 7;
        const { data: eventData } = await (supabaseAdmin.from('events') as any)
          .select('event_date, voice_retention_days')
          .eq('id', eventId)
          .maybeSingle();

        if (eventData?.voice_retention_days) {
          retentionDays = Number(eventData.voice_retention_days);
        }

        let expiresAtDate: string;
        if (eventData?.event_date) {
          const eventDateObj = new Date(eventData.event_date);
          eventDateObj.setDate(eventDateObj.getDate() + retentionDays);
          eventDateObj.setHours(23, 59, 59, 999);
          expiresAtDate = eventDateObj.toISOString();
        } else {
          expiresAtDate = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
        }

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
          if (insertVoiceErr.message.includes('row-level security') || insertVoiceErr.message.includes('RLS')) {
            return NextResponse.json(
              { success: false, message: 'Database RLS policy rejected voice insert. Silakan jalankan script SQL perbaikan RLS di Supabase SQL Editor.' },
              { status: 500 }
            );
          }
        }
      } catch (vErr: any) {
        console.error('Voice processing error:', vErr);
        voiceErrorMsg = vErr.message || 'Unknown voice error';
      }
    }

    // Check if photo was provided initially but failed completely
    if (photoBase64 && !photoPath && photoErrorMsg && !inputGuestId) {
      return NextResponse.json(
        { success: false, message: `Gagal menyimpan foto: ${photoErrorMsg}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      guestId,
      photoId,
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

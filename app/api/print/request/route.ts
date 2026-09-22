import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      eventId,
      photoId,
      guestId,
      guestName,
      layoutType = 'strip_2x6',
      copies = 1,
      notes = null,
    } = body;

    if (!eventId || !photoId) {
      return NextResponse.json(
        { success: false, message: 'Event ID dan Photo ID wajib disertakan.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Verify event exists and is active or client/admin created
    const { data: eventData, error: eventErr } = await (supabaseAdmin.from('events') as any)
      .select('id, name, status')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr || !eventData) {
      return NextResponse.json(
        { success: false, message: 'Event tidak ditemukan.' },
        { status: 404 }
      );
    }

    // Verify photo exists
    const { data: photoData, error: photoErr } = await (supabaseAdmin.from('photos') as any)
      .select('id, event_id, final_photo_path')
      .eq('id', photoId)
      .maybeSingle();

    if (photoErr || !photoData) {
      return NextResponse.json(
        { success: false, message: 'Foto tidak ditemukan.' },
        { status: 404 }
      );
    }

    const sanitizedGuestName = (guestName || 'Tamu Undangan').toString().trim().substring(0, 100);
    const validCopies = Math.max(1, Math.min(10, Number(copies) || 1));
    const validLayout = ['strip_2x6', 'full_4r', 'grid_2r', 'single_strip'].includes(layoutType)
      ? layoutType
      : 'strip_2x6';

    const { data: inserted, error: insertErr } = await (supabaseAdmin.from('print_requests') as any)
      .insert({
        event_id: eventId,
        photo_id: photoId,
        guest_id: guestId || null,
        guest_name: sanitizedGuestName,
        layout_type: validLayout,
        copies: validCopies,
        status: 'pending',
        notes: notes ? notes.toString().trim().substring(0, 255) : null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Error inserting print request:', insertErr);
      return NextResponse.json(
        { success: false, message: 'Gagal mengirim permintaan cetak ke booth.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Permintaan cetak berhasil dikirim! Silakan ambil di booth operator.',
      request: inserted,
    });
  } catch (error: any) {
    console.error('API Print Request Error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

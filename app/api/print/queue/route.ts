import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStoragePublicUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const statusFilter = searchParams.get('status'); // 'all', 'pending', 'completed'

    if (!eventId) {
      return NextResponse.json(
        { success: false, message: 'Event ID wajib disertakan.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    let query = (supabaseAdmin.from('print_requests') as any)
      .select('*, photo:photos(*), guest:guests(*)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: queue, error: queueErr } = await query;

    if (queueErr) {
      console.error('Error fetching print queue:', queueErr);
      return NextResponse.json(
        { success: false, message: 'Gagal memuat antrian cetak.' },
        { status: 500 }
      );
    }

    // Resolve public URL for each photo in the queue
    const resolvedQueue = (queue || []).map((item: any) => {
      let photoWithUrl = null;
      if (item.photo) {
        photoWithUrl = {
          ...item.photo,
          publicUrl: item.photo.final_photo_path
            ? getStoragePublicUrl(item.photo.final_photo_path)
            : null,
        };
      }

      return {
        ...item,
        photo: photoWithUrl,
      };
    });

    const pendingCount = resolvedQueue.filter((item: any) => item.status === 'pending').length;
    const completedCount = resolvedQueue.filter((item: any) => item.status === 'completed').length;

    return NextResponse.json({
      success: true,
      queue: resolvedQueue,
      counts: {
        total: resolvedQueue.length,
        pending: pendingCount,
        completed: completedCount,
      },
    });
  } catch (error: any) {
    console.error('API Print Queue GET Error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { success: false, message: 'Request ID dan status wajib disertakan.' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'printing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Status tidak valid.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    const updatePayload: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updatePayload.printed_at = new Date().toISOString();
    }

    const { data: updated, error: updateErr } = await (supabaseAdmin.from('print_requests') as any)
      .update(updatePayload)
      .eq('id', requestId)
      .select('*, photo:photos(*), guest:guests(*)')
      .maybeSingle();

    if (updateErr) {
      console.error('Error updating print request:', updateErr);
      let msg = updateErr.message || 'Gagal memperbarui status antrian.';
      if (updateErr.code === '42501' || msg.includes('RLS') || msg.includes('row-level security')) {
        msg = 'Supabase RLS Policy menolak operasi ini. Silakan jalankan script SQL "supabase/migrations/09_print_requests_rls_policy.sql" di Supabase SQL Editor.';
      }
      return NextResponse.json(
        { success: false, message: msg },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Data tidak dapat diperbarui. Supabase RLS Policy kemungkinan menolak akses. Silakan jalankan script SQL "supabase/migrations/09_print_requests_rls_policy.sql" di Supabase SQL Editor.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Status antrian berhasil diperbarui.',
      request: updated,
    });
  } catch (error: any) {
    console.error('API Print Queue PATCH Error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('id');

    if (!requestId) {
      return NextResponse.json(
        { success: false, message: 'Request ID wajib disertakan.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    const { error: delErr } = await (supabaseAdmin.from('print_requests') as any)
      .delete()
      .eq('id', requestId);

    if (delErr) {
      console.error('Error deleting print request:', delErr);
      let msg = delErr.message || 'Gagal menghapus antrian cetak.';
      if (delErr.code === '42501' || msg.includes('RLS') || msg.includes('row-level security')) {
        msg = 'Supabase RLS Policy menolak operasi ini. Silakan jalankan script SQL "supabase/migrations/09_print_requests_rls_policy.sql" di Supabase SQL Editor.';
      }
      return NextResponse.json(
        { success: false, message: msg },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Antrian cetak berhasil dihapus.',
    });
  } catch (error: any) {
    console.error('API Print Queue DELETE Error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

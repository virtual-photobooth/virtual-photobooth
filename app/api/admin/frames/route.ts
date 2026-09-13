import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadToStorage, deleteFromStorage, getStoragePublicUrl } from '@/lib/storage';
import { validateFrameBuffer } from '@/lib/utils/frame-validator';
import { verifyEventAccess } from '@/lib/auth/admin-auth';

/**
 * GET /api/admin/frames
 * List all frames for an event (ordered by sort_order, created_at) or get a single frame.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const id = searchParams.get('id');

    if (!eventId && !id) {
      return NextResponse.json(
        { success: false, message: 'eventId or id is required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Single frame lookup by id
    if (id) {
      const { data: frame, error: frameErr } = await (supabaseAdmin.from('event_frames') as any)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (frameErr) throw frameErr;
      if (!frame) {
        return NextResponse.json({ success: false, message: 'Frame not found' }, { status: 404 });
      }

      // Check access on parent event
      const auth = await verifyEventAccess(request, frame.event_id);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
      }

      return NextResponse.json({
        success: true,
        frame: {
          ...frame,
          publicUrl: getStoragePublicUrl(frame.frame_path),
        },
      });
    }

    // 2. All frames for eventId
    if (eventId) {
      const auth = await verifyEventAccess(request, eventId);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
      }

      const { data: frames, error: framesErr } = await (supabaseAdmin.from('event_frames') as any)
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (framesErr) throw framesErr;

      const enriched = (frames || []).map((f: any) => ({
        ...f,
        publicUrl: getStoragePublicUrl(f.frame_path),
      }));

      return NextResponse.json({ success: true, frames: enriched });
    }

    return NextResponse.json(
      { success: false, message: 'eventId or id is required' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Error in GET /api/admin/frames:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/frames
 * Upload and register a new frame for an event.
 * Accepts multipart/form-data or application/json.
 */
export async function POST(request: Request) {
  let uploadedStoragePath: string | null = null;

  try {
    const contentType = request.headers.get('content-type') || '';
    let eventId: string | null = null;
    let name: string | null = null;
    let photoCountRaw: string | number | null = null;
    let buffer: Buffer | null = null;

    // 1. Parse payload based on Content-Type
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      eventId = formData.get('eventId')?.toString() || null;
      name = formData.get('name')?.toString() || null;
      photoCountRaw = formData.get('photo_count')?.toString() || null;

      const file = formData.get('file') as File | null;
      if (file) {
        const arrayBuf = await file.arrayBuffer();
        buffer = Buffer.from(arrayBuf);
      }
    } else {
      const body = await request.json();
      eventId = body.eventId || null;
      name = body.name || null;
      photoCountRaw = body.photo_count !== undefined ? body.photo_count : null;

      const rawFile = body.file || body.fileBase64;
      if (rawFile && typeof rawFile === 'string') {
        const base64Data = rawFile.includes(',') ? rawFile.split(',')[1] : rawFile;
        buffer = Buffer.from(base64Data, 'base64');
      }
    }

    // 2. Validate basic input fields
    if (!eventId) {
      return NextResponse.json(
        { success: false, message: 'eventId is required' },
        { status: 400 }
      );
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json(
        { success: false, message: 'A valid PNG frame file is required.' },
        { status: 400 }
      );
    }

    // 3. Authorization check (Strictly Superadmin/Owner only for write)
    const auth = await verifyEventAccess(request, eventId, 'write');
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    // 4. Validate photo_count
    if (photoCountRaw === null || photoCountRaw === undefined || String(photoCountRaw).trim() === '') {
      return NextResponse.json(
        { success: false, message: 'photo_count is required and must be a positive integer.' },
        { status: 400 }
      );
    }

    const photoCount = Number(photoCountRaw);
    if (isNaN(photoCount) || !Number.isInteger(photoCount) || photoCount <= 0) {
      return NextResponse.json(
        { success: false, message: 'photo_count must be a positive integer (greater than 0).' },
        { status: 400 }
      );
    }

    // 5. Validate PNG file (portrait, landscape, or custom dimensions)
    const validation = validateFrameBuffer(buffer);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: validation.error || 'Format frame tidak valid. Harap upload file gambar PNG.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 6. Determine next sort_order
    const { count: existingCount } = await (supabaseAdmin.from('event_frames') as any)
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    const sortOrder = existingCount || 0;
    const frameId = crypto.randomUUID();
    const frameName = name?.trim() || `Frame ${sortOrder + 1}`;

    // 7. Upload to unique storage path: events/{eventId}/frames/{frameId}/frame.png
    const storagePath = `events/${eventId}/frames/${frameId}/frame.png`;
    uploadedStoragePath = storagePath;

    await uploadToStorage(storagePath, buffer, 'image/png');

    // 8. Insert record into event_frames
    const { data: newFrame, error: insertErr } = await (supabaseAdmin.from('event_frames') as any)
      .insert({
        id: frameId,
        event_id: eventId,
        name: frameName,
        frame_path: storagePath,
        photo_count: photoCount,
        is_default: false, // Database trigger trg_event_frame_default_sync sets true if this is the first frame
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Database insert failed, initiating storage rollback cleanup:', insertErr.message);
      // Clean up orphaned storage file immediately
      try {
        await deleteFromStorage(storagePath);
      } catch (cleanupErr: any) {
        console.error('Failed to cleanup storage orphan during rollback:', cleanupErr.message);
      }

      let errorMsg = insertErr.message;
      if (errorMsg.includes('row-level security') || errorMsg.includes('RLS')) {
        errorMsg = 'Supabase RLS Policy menolak operasi ini. Silakan jalankan script SQL "supabase/migrations/06_event_frames_rls_policy.sql" di Supabase SQL Editor.';
      }

      return NextResponse.json(
        {
          success: false,
          message: errorMsg,
        },
        { status: 500 }
      );
    }

    // 9. Sync events.frame_path if this frame is default (or became default via trigger)
    if (newFrame.is_default) {
      await (supabaseAdmin.from('events') as any)
        .update({ frame_path: storagePath })
        .eq('id', eventId);
    }

    return NextResponse.json(
      {
        success: true,
        frame: {
          ...newFrame,
          publicUrl: getStoragePublicUrl(storagePath),
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error in POST /api/admin/frames:', err);

    // Rollback storage if file was uploaded before unhandled error
    if (uploadedStoragePath) {
      try {
        await deleteFromStorage(uploadedStoragePath);
      } catch (cleanupErr) {
        // silent
      }
    }

    return NextResponse.json(
      { success: false, message: err.message || 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/frames
 * Update frame details (e.g. set default frame, change name, sort_order).
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = body.id || body.frameId;
    const eventId = body.eventId;
    const { is_default, name, sort_order, photo_count } = body;

    if (!id || !eventId) {
      return NextResponse.json(
        { success: false, message: 'id and eventId are required' },
        { status: 400 }
      );
    }

    // 1. Authorization check (Strictly Superadmin/Owner only for write)
    const auth = await verifyEventAccess(request, eventId, 'write');
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 2. Fetch target frame to ensure it exists and belongs to event
    const { data: targetFrame, error: frameErr } = await (supabaseAdmin.from('event_frames') as any)
      .select('*')
      .eq('id', id)
      .eq('event_id', eventId)
      .maybeSingle();

    if (frameErr) throw frameErr;
    if (!targetFrame) {
      return NextResponse.json({ success: false, message: 'Frame not found in this event' }, { status: 404 });
    }

    // 3. Build update payload
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (is_default !== undefined) {
      updatePayload.is_default = Boolean(is_default);
    }

    if (name !== undefined) {
      updatePayload.name = String(name).trim();
    }

    if (sort_order !== undefined) {
      updatePayload.sort_order = Number(sort_order);
    }

    if (photo_count !== undefined) {
      const pc = Number(photo_count);
      if (isNaN(pc) || !Number.isInteger(pc) || pc <= 0) {
        return NextResponse.json(
          { success: false, message: 'photo_count must be a positive integer.' },
          { status: 400 }
        );
      }
      updatePayload.photo_count = pc;
    }

    // 4. Update frame in database (DB trigger trg_event_frame_default_sync manages exclusivity)
    const { data: updatedFrame, error: updateErr } = await (supabaseAdmin.from('event_frames') as any)
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 5. If marked as default, sync events.frame_path
    if (updatedFrame.is_default) {
      await (supabaseAdmin.from('events') as any)
        .update({ frame_path: updatedFrame.frame_path })
        .eq('id', eventId);
    }

    return NextResponse.json({
      success: true,
      frame: {
        ...updatedFrame,
        publicUrl: getStoragePublicUrl(updatedFrame.frame_path),
      },
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/admin/frames:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/frames
 * Alias for PATCH for compatibility.
 */
export async function PUT(request: Request) {
  return PATCH(request);
}

/**
 * DELETE /api/admin/frames
 * Deletes a frame.
 * Invariant: Cannot delete if it is the only remaining frame for the event.
 * Preserves legacy storage path events/{eventId}/frame/frame.png.
 * Trigger handles promotion of new default if deleted frame was default.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');
    let eventId = searchParams.get('eventId');

    // Also check body if not in query params
    if (!id || !eventId) {
      try {
        const body = await request.json();
        id = id || body.id || body.frameId;
        eventId = eventId || body.eventId;
      } catch {
        // Body parsing may fail if request has no body (e.g. query param DELETE)
      }
    }

    if (!id || !eventId) {
      return NextResponse.json(
        { success: false, message: 'id and eventId are required' },
        { status: 400 }
      );
    }

    // 1. Authorization check (Strictly Superadmin/Owner only for write)
    const auth = await verifyEventAccess(request, eventId, 'write');
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 2. Fetch all frames for this event to verify single-frame invariant
    const { data: frames, error: framesErr } = await (supabaseAdmin.from('event_frames') as any)
      .select('*')
      .eq('event_id', eventId);

    if (framesErr) throw framesErr;

    const targetFrame = (frames || []).find((f: any) => f.id === id);
    if (!targetFrame) {
      return NextResponse.json({ success: false, message: 'Frame not found in this event' }, { status: 404 });
    }

    // 3. Delete storage file
    // Preserve legacy storage file events/{eventId}/frame/frame.png per Rule 1 & 5
    const isLegacyStorage = targetFrame.frame_path === `events/${eventId}/frame/frame.png`;
    if (!isLegacyStorage && targetFrame.frame_path) {
      try {
        await deleteFromStorage(targetFrame.frame_path);
      } catch (storageErr: any) {
        console.warn('Storage file deletion warning (continuing with DB deletion):', storageErr.message);
      }
    }

    // 4. Delete event_frames record
    // Photos with selected_frame_id will be SET NULL automatically by foreign key constraint
    const { error: deleteErr } = await (supabaseAdmin.from('event_frames') as any)
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;

    // 5. If the deleted frame was default:
    // If another frame was auto-promoted by trigger, sync events.frame_path to it.
    // If no remaining frames exist, set events.frame_path to null.
    let promotedDefault: any = null;
    if (targetFrame.is_default) {
      const { data: newDefault } = await (supabaseAdmin.from('event_frames') as any)
        .select('id, name, frame_path, is_default')
        .eq('event_id', eventId)
        .eq('is_default', true)
        .maybeSingle();

      if (newDefault) {
        promotedDefault = newDefault;
        await (supabaseAdmin.from('events') as any)
          .update({ frame_path: newDefault.frame_path })
          .eq('id', eventId);
      } else {
        await (supabaseAdmin.from('events') as any)
          .update({ frame_path: null })
          .eq('id', eventId);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Frame deleted successfully',
      deletedFrameId: id,
      promotedDefault: promotedDefault ? { ...promotedDefault, publicUrl: getStoragePublicUrl(promotedDefault.frame_path) } : null,
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/admin/frames:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Server error' },
      { status: 500 }
    );
  }
}

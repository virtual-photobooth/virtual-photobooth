import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const slug = searchParams.get('slug');

    const supabaseAdmin = createAdminClient();

    if (id) {
      const { data, error } = await (supabaseAdmin.from('events') as any)
        .select('*, client:clients(*)')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return NextResponse.json({ success: true, event: data });
    }

    if (slug) {
      const { data, error } = await (supabaseAdmin.from('events') as any)
        .select('*, client:clients(*)')
        .eq('slug', slug)
        .maybeSingle();

      if (error) throw error;
      return NextResponse.json({ success: true, event: data });
    }

    const { data, error } = await (supabaseAdmin.from('events') as any)
      .select('*, client:clients(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, events: data || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      client_id,
      name,
      monogram,
      subtitle,
      slug,
      event_date,
      status,
      photo_count,
      countdown_seconds,
      is_voice_enabled,
      voice_retention_days,
      frame_path,
      cover_path,
    } = body;

    if (!client_id || !name || !slug) {
      return NextResponse.json(
        { success: false, message: 'Client, Event Name, and Slug are required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Check slug uniqueness
    const { data: existing } = await (supabaseAdmin.from('events') as any)
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, message: `Slug "${slug}" is already taken. Please use another slug.` },
        { status: 400 }
      );
    }

    const insertPayload: any = {
      client_id,
      name,
      slug,
      event_date: event_date || new Date().toISOString().split('T')[0],
      status: status || 'active',
      photo_count: photo_count ? Number(photo_count) : 4,
      countdown_seconds: countdown_seconds ? Number(countdown_seconds) : 3,
      is_voice_enabled: is_voice_enabled !== undefined ? Boolean(is_voice_enabled) : true,
      voice_retention_days: voice_retention_days ? Number(voice_retention_days) : 7,
      frame_path: frame_path || null,
    };

    if (monogram) insertPayload.monogram = monogram;
    if (subtitle) insertPayload.subtitle = subtitle;
    if (cover_path) insertPayload.cover_path = cover_path;

    let { data, error } = await (supabaseAdmin.from('events') as any)
      .insert(insertPayload)
      .select()
      .single();

    // Fallback if optional schema columns (monogram, subtitle, cover_path) are missing in DB table
    if (error) {
      console.warn('Initial insert error, stripping extended columns:', error.message);
      delete insertPayload.monogram;
      delete insertPayload.subtitle;
      delete insertPayload.cover_path;

      const { data: retryData, error: retryError } = await (supabaseAdmin.from('events') as any)
        .insert(insertPayload)
        .select()
        .single();

      if (retryError) throw retryError;
      data = retryData;
    }

    return NextResponse.json({ success: true, event: data });
  } catch (err: any) {
    console.error('Error creating event:', err);
    let msg = err.message || 'Server error';
    if (msg.includes('row-level security') || msg.includes('RLS')) {
      msg = 'Supabase RLS Policy menolak operasi ini. Silakan jalankan script SQL perbaikan RLS di Supabase SQL Editor.';
    }
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Event ID is required.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    let { data, error } = await (supabaseAdmin.from('events') as any)
      .update({
        ...updateFields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('Initial update error, stripping optional extended columns:', error.message);
      delete updateFields.monogram;
      delete updateFields.subtitle;
      delete updateFields.cover_path;

      const { data: retryData, error: retryError } = await (supabaseAdmin.from('events') as any)
        .update({
          ...updateFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (retryError) throw retryError;
      data = retryData;
    }

    return NextResponse.json({ success: true, event: data });
  } catch (err: any) {
    console.error('Error updating event:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Event ID is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { error } = await (supabaseAdmin.from('events') as any).delete().eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

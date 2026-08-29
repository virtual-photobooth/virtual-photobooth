import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { path, fileBase64, contentType } = body;

    if (!path || !fileBase64) {
      return NextResponse.json({ success: false, message: 'Path and fileBase64 are required.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const rawBase64 = String(fileBase64);
    const base64Data = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    const cleanContentType = contentType || (path.endsWith('.png') ? 'image/png' : 'image/jpeg');

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('virtual-photobooth')
      .upload(path, buffer, {
        upsert: true,
        contentType: cleanContentType,
      });

    if (uploadErr) {
      console.error('Admin storage upload error:', uploadErr.message);
      return NextResponse.json({ success: false, message: uploadErr.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('virtual-photobooth')
      .getPublicUrl(path);

    return NextResponse.json({
      success: true,
      path,
      publicUrl: publicUrlData?.publicUrl || '',
    });
  } catch (err: any) {
    console.error('Error in /api/admin/storage/upload:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}

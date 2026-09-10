import { NextResponse } from 'next/server';
import { uploadToStorage, getStoragePublicUrl } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { path, fileBase64, contentType } = body;

    if (!path || !fileBase64) {
      return NextResponse.json({ success: false, message: 'Path and fileBase64 are required.' }, { status: 400 });
    }

    const rawBase64 = String(fileBase64);
    const base64Data = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    const cleanContentType = contentType || (path.endsWith('.png') ? 'image/png' : 'image/jpeg');

    const uploadRes = await uploadToStorage(path, buffer, cleanContentType);

    return NextResponse.json({
      success: true,
      path: uploadRes.path,
      publicUrl: uploadRes.publicUrl || getStoragePublicUrl(uploadRes.path),
      provider: uploadRes.provider,
    });
  } catch (err: any) {
    console.error('Error in /api/admin/storage/upload:', err);
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}

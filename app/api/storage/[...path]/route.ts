import { NextResponse } from 'next/server';
import { getR2Client, getStorageBucketName, isR2Configured } from '@/lib/storage/r2';
import { cleanStoragePath } from '@/lib/storage/url';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const rawKey = pathSegments.join('/');
    const bucket = getStorageBucketName();
    const cleanKey = cleanStoragePath(rawKey, bucket);

    if (!cleanKey) {
      return new NextResponse('File not found', { status: 404 });
    }

    // 1. Try serving directly from Cloudflare R2 via S3 SDK
    if (isR2Configured()) {
      try {
        const client = getR2Client();
        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: cleanKey,
        });
        const response = await client.send(command);

        if (response.Body) {
          const stream = response.Body.transformToWebStream();
          const headers = new Headers();

          if (response.ContentType) headers.set('Content-Type', response.ContentType);
          if (response.ContentLength) headers.set('Content-Length', response.ContentLength.toString());
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          headers.set('Access-Control-Allow-Origin', '*');

          return new NextResponse(stream as any, {
            status: 200,
            headers,
          });
        }
      } catch (r2Err: any) {
        console.warn('R2 storage fetch error:', r2Err.message);
      }
    }

    // 2. Fallback to Supabase Storage
    try {
      const supabaseAdmin = createAdminClient();
      const { data: blob, error } = await supabaseAdmin.storage.from(bucket).download(cleanKey);
      if (!error && blob) {
        const headers = new Headers();
        if (blob.type) headers.set('Content-Type', blob.type);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('Access-Control-Allow-Origin', '*');

        return new NextResponse(blob, {
          status: 200,
          headers,
        });
      }
    } catch (supabaseErr: any) {
      console.warn('Supabase storage fetch fallback error:', supabaseErr.message);
    }

    return new NextResponse('File not found', { status: 404 });
  } catch (err: any) {
    console.error('Storage proxy error:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

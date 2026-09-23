import { NextResponse } from 'next/server';
import { getR2Client, getStorageBucketName, isR2Configured } from '@/lib/storage/r2';
import { cleanStoragePath } from '@/lib/storage/url';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
      'Access-Control-Max-Age': '86400',
    },
  });
}

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

    const rangeHeader = request.headers.get('range') || request.headers.get('Range') || undefined;

    // 1. Try serving directly from Cloudflare R2 via S3 SDK
    if (isR2Configured()) {
      try {
        const client = getR2Client();
        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: cleanKey,
          ...(rangeHeader ? { Range: rangeHeader } : {}),
        });
        const response = await client.send(command);

        if (response.Body) {
          const stream = response.Body.transformToWebStream();
          const headers = new Headers();

          if (response.ContentType) headers.set('Content-Type', response.ContentType);
          if (response.ContentLength) headers.set('Content-Length', response.ContentLength.toString());
          if (response.ContentRange) headers.set('Content-Range', response.ContentRange);
          headers.set('Accept-Ranges', 'bytes');

          const cacheControl = cleanKey.includes('/photos/')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600, stale-while-revalidate=86400';
          headers.set('Cache-Control', cacheControl);
          headers.set('Access-Control-Allow-Origin', '*');
          headers.set('Access-Control-Allow-Headers', 'Range, Content-Type');
          headers.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

          const status = response.$metadata.httpStatusCode || (response.ContentRange ? 206 : 200);

          return new NextResponse(stream as any, {
            status,
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
        const contentType =
          blob.type ||
          (cleanKey.endsWith('.m4a')
            ? 'audio/mp4'
            : cleanKey.endsWith('.webm')
            ? 'audio/webm'
            : 'application/octet-stream');
        headers.set('Content-Type', contentType);
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Headers', 'Range, Content-Type');
        headers.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

        const cacheControl = cleanKey.includes('/photos/')
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600, stale-while-revalidate=86400';
        headers.set('Cache-Control', cacheControl);

        const arrayBuffer = await blob.arrayBuffer();
        const totalSize = arrayBuffer.byteLength;

        if (rangeHeader && rangeHeader.startsWith('bytes=')) {
          const parts = rangeHeader.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10) || 0;
          const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

          if (start < totalSize && end >= start) {
            const chunk = arrayBuffer.slice(start, end + 1);
            headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
            headers.set('Content-Length', chunk.byteLength.toString());

            return new NextResponse(chunk, {
              status: 206,
              headers,
            });
          }
        }

        headers.set('Content-Length', totalSize.toString());
        return new NextResponse(arrayBuffer, {
          status: 200,
          headers,
        });
      }
    } catch (supabaseErr: any) {
      console.warn('Supabase storage fetch fallback error:', supabaseErr.message);
    }

    // 3. Fallback to production storage endpoint (supports local development when R2 is only on prod)
    try {
      const fetchHeaders: HeadersInit = rangeHeader ? { Range: rangeHeader } : {};
      const prodRes = await fetch(`https://virtual-photobooth-taupe.vercel.app/api/storage/${cleanKey}`, {
        headers: fetchHeaders,
      });
      if (prodRes.ok || prodRes.status === 206) {
        const headers = new Headers();
        const contentType = prodRes.headers.get('Content-Type');
        if (contentType) headers.set('Content-Type', contentType);
        const contentLength = prodRes.headers.get('Content-Length');
        if (contentLength) headers.set('Content-Length', contentLength);
        const contentRange = prodRes.headers.get('Content-Range');
        if (contentRange) headers.set('Content-Range', contentRange);
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Headers', 'Range, Content-Type');
        headers.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

        const cacheControl = cleanKey.includes('/photos/')
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600, stale-while-revalidate=86400';
        headers.set('Cache-Control', cacheControl);

        return new NextResponse(prodRes.body as any, {
          status: prodRes.status,
          headers,
        });
      }
    } catch (prodErr: any) {
      console.warn('Production storage fallback error:', prodErr.message);
    }

    return new NextResponse('File not found', { status: 404 });
  } catch (err: any) {
    console.error('Storage proxy error:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

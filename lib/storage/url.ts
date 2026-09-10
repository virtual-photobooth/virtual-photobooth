/**
 * Client-safe storage URL utilities.
 * Can be safely imported in both client and server components.
 */

/**
 * Cleans a file path by removing full URLs, leading slashes, and redundant bucket prefixes.
 */
export function cleanStoragePath(pathOrUrl: string | null | undefined, bucket = 'virtual-photobooth'): string {
  if (!pathOrUrl) return '';
  let p = pathOrUrl.trim();

  if (p.startsWith('http://') || p.startsWith('https://')) {
    try {
      const url = new URL(p);
      p = url.pathname;
    } catch {
      // ignore
    }
  }

  // Handle Supabase Storage public path prefix
  const bucketPrefix = `/storage/v1/object/public/${bucket}/`;
  if (p.includes(bucketPrefix)) {
    p = p.substring(p.indexOf(bucketPrefix) + bucketPrefix.length);
  }

  // Handle prefix with bucket name
  if (p.startsWith(`${bucket}/`)) {
    p = p.substring(bucket.length + 1);
  }

  // Handle api/storage proxy prefix
  if (p.startsWith('api/storage/')) {
    p = p.substring('api/storage/'.length);
  }
  if (p.startsWith('/api/storage/')) {
    p = p.substring('/api/storage/'.length);
  }

  // Remove leading slash
  if (p.startsWith('/')) {
    p = p.substring(1);
  }

  return p;
}

/**
 * Resolves the public CDN/access URL for an asset.
 * - If a custom domain (not *.r2.dev) is set in NEXT_PUBLIC_R2_PUBLIC_URL, uses that CDN domain.
 * - If *.r2.dev is used or empty, automatically routes via `/api/storage/...` proxy to
 *   completely bypass Indonesian ISP / Internet Positif blocks on r2.dev.
 */
export function getStoragePublicUrl(pathOrUrl: string | null | undefined, bucket = 'virtual-photobooth'): string {
  if (!pathOrUrl) return '';
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return '';

  const cleanKey = cleanStoragePath(trimmed, bucket);
  if (!cleanKey) return '';

  const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim();

  // If a custom domain (that is NOT r2.dev) is configured, deliver directly via custom CDN
  if (r2PublicUrl && !r2PublicUrl.includes('.r2.dev')) {
    return `${r2PublicUrl.replace(/\/+$/, '')}/${cleanKey}`;
  }

  // Default: Use internal proxy which fetches from R2 S3 API and streams to client.
  // This bypasses Internet Positif blockage on *.r2.dev domains in Indonesia.
  return `/api/storage/${cleanKey}`;
}

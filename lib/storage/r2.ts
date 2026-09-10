import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';
import { createAdminClient } from '@/lib/supabase/admin';
import { cleanStoragePath, getStoragePublicUrl } from './url';

let s3ClientInstance: S3Client | null = null;

/**
 * Checks whether Cloudflare R2 credentials are fully configured.
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
    process.env.R2_ACCESS_KEY_ID?.trim() &&
    process.env.R2_SECRET_ACCESS_KEY?.trim()
  );
}

/**
 * Gets the Cloudflare R2 S3 Client instance (singleton).
 */
export function getR2Client(): S3Client {
  if (!s3ClientInstance) {
    const accountId = process.env.R2_ACCOUNT_ID?.trim();
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'Cloudflare R2 credentials are not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.'
      );
    }

    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
}

/**
 * Returns the target bucket name for R2 or Supabase.
 */
export function getStorageBucketName(): string {
  return process.env.R2_BUCKET_NAME?.trim() || 'virtual-photobooth';
}

/**
 * Uploads a file buffer to storage (Cloudflare R2, with fallback to Supabase Storage).
 */
export async function uploadToStorage(
  path: string,
  buffer: Buffer | Uint8Array,
  contentType: string,
  bucket = getStorageBucketName()
): Promise<{ success: boolean; path: string; publicUrl: string; provider: 'r2' | 'supabase' }> {
  const cleanPath = cleanStoragePath(path, bucket);

  if (isR2Configured()) {
    try {
      const client = getR2Client();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: cleanPath,
          Body: buffer,
          ContentType: contentType,
        })
      );

      const publicUrl = getStoragePublicUrl(cleanPath, bucket);
      return {
        success: true,
        path: cleanPath,
        publicUrl,
        provider: 'r2',
      };
    } catch (r2Error: any) {
      console.error('Cloudflare R2 upload error, falling back to Supabase:', r2Error.message);
      // Fallback below if R2 fails
    }
  }

  // Supabase Storage Fallback
  const supabaseAdmin = createAdminClient();
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(bucket)
    .upload(cleanPath, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Storage upload failed: ${uploadErr.message}`);
  }

  const publicUrl = getStoragePublicUrl(cleanPath, bucket);
  return {
    success: true,
    path: cleanPath,
    publicUrl,
    provider: 'supabase',
  };
}

/**
 * Deletes a single file from storage (Cloudflare R2 or Supabase).
 */
export async function deleteFromStorage(
  pathOrUrl: string,
  bucket = getStorageBucketName()
): Promise<void> {
  const cleanPath = cleanStoragePath(pathOrUrl, bucket);
  if (!cleanPath) return;

  if (isR2Configured()) {
    try {
      const client = getR2Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: cleanPath,
        })
      );
      return;
    } catch (r2Err: any) {
      console.error('Cloudflare R2 delete error:', r2Err.message);
    }
  }

  // Supabase Storage Fallback
  try {
    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.storage.from(bucket).remove([cleanPath]);
  } catch (supabaseErr: any) {
    console.error('Supabase storage delete error:', supabaseErr.message);
  }
}

/**
 * Deletes multiple files from storage in batches.
 */
export async function deleteMultipleFromStorage(
  pathsOrUrls: string[],
  bucket = getStorageBucketName()
): Promise<void> {
  if (!pathsOrUrls || pathsOrUrls.length === 0) return;

  const cleanPaths = Array.from(
    new Set(pathsOrUrls.map((p) => cleanStoragePath(p, bucket)).filter(Boolean))
  );

  if (cleanPaths.length === 0) return;

  if (isR2Configured()) {
    try {
      const client = getR2Client();
      // S3 DeleteObjectsCommand supports up to 1000 keys per request
      for (let i = 0; i < cleanPaths.length; i += 1000) {
        const batch = cleanPaths.slice(i, i + 1000);
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: batch.map((k) => ({ Key: k })),
              Quiet: true,
            },
          })
        );
      }
      return;
    } catch (r2Err: any) {
      console.error('Cloudflare R2 batch delete error, trying Supabase fallback:', r2Err.message);
    }
  }

  // Supabase Storage Fallback (chunks of 100)
  try {
    const supabaseAdmin = createAdminClient();
    for (let i = 0; i < cleanPaths.length; i += 100) {
      const chunk = cleanPaths.slice(i, i + 100);
      await supabaseAdmin.storage.from(bucket).remove(chunk);
    }
  } catch (supabaseErr: any) {
    console.error('Supabase storage batch delete error:', supabaseErr.message);
  }
}

/**
 * Lists all file keys under a prefix in storage.
 */
export async function listStorageFiles(
  prefix: string,
  bucket = getStorageBucketName()
): Promise<string[]> {
  const cleanPrefix = cleanStoragePath(prefix, bucket);

  if (isR2Configured()) {
    try {
      const client = getR2Client();
      let continuationToken: string | undefined = undefined;
      const results: string[] = [];

      do {
        const response: ListObjectsV2CommandOutput = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: cleanPrefix ? (cleanPrefix.endsWith('/') ? cleanPrefix : `${cleanPrefix}/`) : undefined,
            ContinuationToken: continuationToken,
          })
        );

        if (response.Contents) {
          for (const item of response.Contents) {
            if (item.Key) {
              results.push(item.Key);
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return results;
    } catch (r2Err: any) {
      console.error('Cloudflare R2 list error, falling back to Supabase:', r2Err.message);
    }
  }

  // Supabase Storage recursive list fallback
  return listSupabaseFilesRecursively(bucket, cleanPrefix);
}

async function listSupabaseFilesRecursively(bucket: string, prefix: string): Promise<string[]> {
  const supabaseAdmin = createAdminClient();
  let results: string[] = [];

  const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix);
  if (error || !data) return results;

  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      const sub = await listSupabaseFilesRecursively(bucket, fullPath);
      results = results.concat(sub);
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

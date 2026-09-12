import { createClient } from '@/lib/supabase/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { Event } from '@/lib/types/database';

export interface ValidationResult {
  isValid: boolean;
  event: Event | null;
  reason: 'valid' | 'not_found' | 'inactive' | 'expired';
}

/**
 * Checks if an event has passed its retention expiration period.
 * Anchored to end-of-day in WITA (UTC+08:00, Bali / Asia/Makassar)
 * to prevent premature expiration due to UTC difference.
 */
export function isEventExpired(eventDateStr?: string | null, retentionDays: number = 7): boolean {
  if (!eventDateStr) return false;

  const datePart = eventDateStr.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return false;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;

  // Add retention days to the target date
  const targetDate = new Date(Date.UTC(year, month, day));
  targetDate.setUTCDate(targetDate.getUTCDate() + (retentionDays || 7));

  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const targetDay = String(targetDate.getUTCDate()).padStart(2, '0');

  // End of day in WITA (UTC+8): 23:59:59.999+08:00
  const expiryIsoString = `${targetYear}-${targetMonth}-${targetDay}T23:59:59.999+08:00`;
  const expiryTimestamp = new Date(expiryIsoString).getTime();

  return Date.now() > expiryTimestamp;
}

/**
 * Validates a public event URL based strictly on slug.
 * 
 * Rules:
 * 1. ONE URL = ONE EVENT.
 * 2. Lookup strictly based on events.slug (never slugOrId / ID fallback).
 * 3. Exact slug match first, then safe case-insensitive match.
 * 4. NEVER use active event fallback, latest event, or default event.
 * 5. Verify event exists, status === 'active', and not expired.
 */
export async function validateEventSlug(
  slug: string,
  options?: { useAdmin?: boolean }
): Promise<ValidationResult> {
  if (!slug || typeof slug !== 'string' || !slug.trim()) {
    return { isValid: false, event: null, reason: 'not_found' };
  }

  const decodedSlug = decodeURIComponent(slug).trim();

  // Pick client based on context (admin client for server, browser client for client)
  const supabase = options?.useAdmin ? createAdminClient() : createClient();

  // 1. Exact match on slug
  let { data: event } = await (supabase.from('events') as any)
    .select('*')
    .eq('slug', decodedSlug)
    .maybeSingle();

  // 2. Safe case-insensitive match on slug if exact match not found
  if (!event) {
    const { data: ilikeEvent } = await (supabase.from('events') as any)
      .select('*')
      .ilike('slug', decodedSlug)
      .maybeSingle();
    if (ilikeEvent) {
      event = ilikeEvent;
    }
  }

  // 3. Event does not exist in database (or was deleted)
  if (!event) {
    return { isValid: false, event: null, reason: 'not_found' };
  }

  // 4. Verify event status is active
  if (event.status !== 'active') {
    return { isValid: false, event: null, reason: 'inactive' };
  }

  // 5. Verify event has not expired according to retention policy
  const retentionDays = event.voice_retention_days ? Number(event.voice_retention_days) : 7;
  if (isEventExpired(event.event_date, retentionDays)) {
    return { isValid: false, event: null, reason: 'expired' };
  }

  return { isValid: true, event: event as Event, reason: 'valid' };
}

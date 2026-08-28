import { SupabaseClient } from '@supabase/supabase-js';
import { generateSlug } from './slug';

export interface GeneratedCredentials {
  email: string;
  password: string;
}

export function generateUniquePassword(name: string): string {
  const cleanName = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 6)
    .toUpperCase() || 'HOST';
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `VP-${cleanName}-${randomNum}`;
}

export async function generateUniqueClientCredentials(
  supabase: SupabaseClient,
  clientOrEventName: string
): Promise<GeneratedCredentials> {
  const baseSlug = generateSlug(clientOrEventName) || 'client-host';
  let emailCandidate = `${baseSlug}@photobooth.com`;

  let attempts = 0;
  while (attempts < 10) {
    const { data: existing } = await (supabase.from('clients') as any)
      .select('id')
      .ilike('contact_email', emailCandidate)
      .maybeSingle();

    if (!existing) {
      break;
    }

    attempts++;
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    emailCandidate = `${baseSlug}-${randomSuffix}@photobooth.com`;
  }

  const password = generateUniquePassword(clientOrEventName);

  return {
    email: emailCandidate,
    password,
  };
}

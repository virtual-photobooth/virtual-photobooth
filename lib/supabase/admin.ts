import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const DEFAULT_URL = 'https://ppagmnujulyyvehizvqr.supabase.co';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwYWdtbnVqdWx5eXZlaGl6dnFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4Mjc0MzYsImV4cCI6MjEwMzQwMzQzNn0.BqHfI-8IQjwhcsnqEbpyRMqzEwsLukSA4NBKLO3rd-s';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey && typeof window === 'undefined') {
    console.warn(
      '[WARNING] SUPABASE_SERVICE_ROLE_KEY environment variable is not defined! API routes are using ANON_KEY which may hit RLS restrictions.'
    );
  }

  const key = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

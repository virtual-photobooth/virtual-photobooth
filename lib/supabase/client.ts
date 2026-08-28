import { createBrowserClient } from '@supabase/ssr';
import { Database } from '../types/database';

const DEFAULT_URL = 'https://ppagmnujulyyvehizvqr.supabase.co';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwYWdtbnVqdWx5eXZlaGl6dnFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4Mjc0MzYsImV4cCI6MjEwMzQwMzQzNn0.BqHfI-8IQjwhcsnqEbpyRMqzEwsLukSA4NBKLO3rd-s';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY
  );
}

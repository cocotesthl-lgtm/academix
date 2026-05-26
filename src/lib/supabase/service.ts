import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let cached: ReturnType<typeof createClient> | null = null;

export function getServiceClient() {
  if (cached) return cached;
  cached = createClient(env.supabase.url(), env.supabase.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return cached;
}

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabase.url(), env.supabase.anonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
        try {
          for (const { name, value, options } of toSet) {
            const opts = { ...options };
            if (env.cookieDomain && !('domain' in opts)) {
              opts.domain = env.cookieDomain;
            }
            cookieStore.set(name, value, opts);
          }
        } catch {
          // Called from a Server Component — ignore; refresh happens via middleware/proxy.
        }
      }
    }
  });
}

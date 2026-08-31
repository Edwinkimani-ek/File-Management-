import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { env } from '@/lib/env';

/**
 * Supabase client bound to the signed-in user's cookies. Every query made
 * through it runs under that user's row-level security policies, which is
 * where tenancy and role rules are actually enforced.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Called from a Server Component; the middleware refreshes it.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // As above.
        }
      },
    },
  });
}

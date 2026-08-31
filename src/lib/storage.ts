import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Ten minutes, per the Feature 4 acceptance test. */
export const SIGNED_URL_TTL_SECONDS = 600;

export async function signedUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  options?: { download?: string; expiresIn?: number },
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, options?.expiresIn ?? SIGNED_URL_TTL_SECONDS, {
      download: options?.download,
    });
  if (error || !data) return null;
  return data.signedUrl;
}

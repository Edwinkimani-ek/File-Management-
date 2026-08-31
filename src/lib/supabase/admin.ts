import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { describeCredentialProblem, env } from '@/lib/env';

/**
 * Service-role client. It bypasses row-level security, so it is only ever
 * used for the handful of operations that have no signed-in user to run
 * as: firm signup, redeeming an invitation, and the scheduled reminder
 * job. Never import this into anything that handles ordinary requests.
 */
export function createAdminClient() {
  const problem = describeCredentialProblem(
    'SUPABASE_SERVICE_ROLE_KEY',
    env.supabaseServiceRoleKey,
  );
  if (problem) throw new Error(problem);
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

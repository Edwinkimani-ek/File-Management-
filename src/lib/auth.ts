import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppUser, Firm, UserRole } from '@/lib/types';

export interface SessionContext {
  user: AppUser;
  firm: Firm;
}

/**
 * The signed-in user's profile and firm, or null. Cached per request so
 * that a page and its layout do not each pay for the round trip.
 *
 * A user whose status is 'disabled' resolves to null here and is blocked
 * by every row-level security policy, so disabling someone takes their
 * access away on their very next request rather than at token expiry.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', auth.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!profile) return null;

  const { data: firm } = await supabase
    .from('firms')
    .select('*')
    .eq('id', profile.firm_id)
    .maybeSingle();
  if (!firm) return null;

  return { user: profile as AppUser, firm: firm as Firm };
});

export async function requireSession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  return session;
}

/**
 * Gate a page on role. This is the UI half of the check only — the
 * matching database policy is what actually stops a forged request.
 */
export async function requireRole(...roles: UserRole[]): Promise<SessionContext> {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) redirect('/forbidden');
  return session;
}

export { can } from '@/lib/permissions';

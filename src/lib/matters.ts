import 'server-only';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Matter, UserRole } from '@/lib/types';

export interface MatterWithRelations extends Matter {
  clients: { id: string; full_name: string; phone: string | null; email: string | null } | null;
  assignee: { id: string; full_name: string } | null;
}

/**
 * Loads a matter the caller is entitled to see. A matter belonging to
 * another firm, or one this user is not on, simply is not there — the
 * policy filters it out and this 404s, which is also the answer for an
 * id that was guessed or pasted from somewhere else.
 */
export async function loadMatter(id: string): Promise<MatterWithRelations> {
  const supabase = createClient();
  const { data } = await supabase
    .from('matters')
    .select(
      '*, clients:client_id (id, full_name, phone, email), assignee:assigned_to (id, full_name)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) notFound();
  return data as unknown as MatterWithRelations;
}

/** A closed matter is read-only for everyone except a partner. */
export function canWriteToMatter(matter: Matter, role: UserRole): boolean {
  if (role === 'partner') return true;
  return matter.status !== 'closed';
}

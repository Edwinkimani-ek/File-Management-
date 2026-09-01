import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ActivityAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password_reset'
  | 'document.viewed'
  | 'document.downloaded'
  | 'document.uploaded'
  | 'document.deleted'
  | 'document.updated'
  | 'client.created'
  | 'client.updated'
  | 'matter.created'
  | 'matter.updated'
  | 'matter.closed'
  | 'diary.created'
  | 'diary.updated'
  | 'fee_note.created'
  | 'fee_note.sent'
  | 'fee_note.pdf_downloaded'
  | 'payment.recorded'
  | 'user.invited'
  | 'ai.assistant';

/**
 * Appends to activity_log. Never throws: an audit write failing must not
 * take down the action the user was performing, but it should be loud in
 * the server logs.
 */
export async function logActivity(
  supabase: SupabaseClient,
  entry: {
    firmId: string;
    userId: string;
    action: ActivityAction;
    entityType: string;
    entityId?: string | null;
    matterId?: string | null;
    detail?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('activity_log').insert({
    firm_id: entry.firmId,
    user_id: entry.userId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    matter_id: entry.matterId ?? null,
    detail: entry.detail ?? null,
  });
  if (error) {
    console.error('activity_log write failed', entry.action, error.message);
  }
}

export const ACTIVITY_LABELS: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.password_reset': 'Reset their password',
  'document.viewed': 'Viewed a document',
  'document.downloaded': 'Downloaded a document',
  'document.uploaded': 'Uploaded a document',
  'document.deleted': 'Deleted a document',
  'document.updated': 'Updated a document',
  'client.created': 'Created a client',
  'client.updated': 'Updated a client',
  'matter.created': 'Opened a matter',
  'matter.updated': 'Updated a matter',
  'matter.closed': 'Closed a matter',
  'matter.deleted': 'Deleted a matter',
  'diary.created': 'Added a diary event',
  'diary.updated': 'Updated a diary event',
  'fee_note.created': 'Created a fee note',
  'fee_note.approved': 'Approved a fee note',
  'fee_note.sent': 'Marked a fee note as sent',
  'fee_note.pdf_downloaded': 'Downloaded a fee note PDF',
  'payment.recorded': 'Recorded a payment',
  'user.invited': 'Invited a user',
  'user.role_changed': 'Changed a user role',
  'user.status_changed': 'Changed a user status',
  'ai.assistant': 'Used the AI assistant',
};

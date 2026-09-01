'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { hashToken, inviteUrl, newInviteToken, sendInviteEmail } from '@/lib/invitations';
import { ROLE_LABELS } from '@/lib/labels';
import { friendlyDbError, text, type FormState } from '@/lib/forms';
import type { UserRole } from '@/lib/types';

const ROLES: UserRole[] = ['partner', 'associate', 'clerk'];

export async function inviteUserAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user, firm } = await requireRole('partner');
  const supabase = createClient();

  const email = text(data, 'email').toLowerCase();
  const fullName = text(data, 'full_name');
  const role = text(data, 'role') as UserRole;

  if (!email || !fullName) return { error: 'Enter a name and an email address.' };
  if (!ROLES.includes(role)) return { error: 'Choose a role.' };

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('firm_id', firm.id)
    .ilike('email', email)
    .maybeSingle();
  if (existing) return { error: 'That person is already a user in this firm.' };

  const token = newInviteToken();
  const { error } = await supabase.from('invitations').insert({
    firm_id: firm.id,
    email,
    full_name: fullName,
    role,
    token_hash: hashToken(token),
    invited_by: user.id,
  });
  if (error) return { error: friendlyDbError(error.message) };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'user.invited',
    entityType: 'invitation',
    detail: `${fullName} <${email}> as ${ROLE_LABELS[role]}`,
  });

  const mail = await sendInviteEmail({
    firmName: firm.name,
    to: email,
    fullName,
    roleLabel: ROLE_LABELS[role],
    token,
  });

  revalidatePath('/users');

  if (!mail.sent) {
    // Email is not wired up yet (or bounced). Hand the partner the link so
    // the invitation is still usable rather than silently lost.
    return {
      success: `Invitation created, but the email could not be sent (${mail.error}). Share this link with ${fullName}: ${inviteUrl(token)}`,
    };
  }
  return { success: `Invitation emailed to ${email}.` };
}

export async function revokeInviteAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  await requireRole('partner');
  const supabase = createClient();
  const id = text(data, 'invitation_id');
  if (!id) return { error: 'No invitation selected.' };

  const { error } = await supabase
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath('/users');
  return { success: 'Invitation withdrawn.' };
}

export async function updateUserAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user, firm } = await requireRole('partner');
  const supabase = createClient();

  const userId = text(data, 'user_id');
  const role = text(data, 'role') as UserRole;
  const status = text(data, 'status');

  if (!userId) return { error: 'No user selected.' };
  if (!ROLES.includes(role)) return { error: 'Choose a role.' };
  if (status !== 'active' && status !== 'disabled') return { error: 'Choose a status.' };
  if (userId === user.id && status === 'disabled') {
    return { error: 'You cannot disable your own account.' };
  }

  const { error } = await supabase
    .from('users')
    .update({ role, status })
    .eq('id', userId)
    .eq('firm_id', firm.id);
  if (error) return { error: friendlyDbError(error.message) };

  // The status column alone is already decisive: every security helper
  // and therefore every policy returns nothing for a disabled user, so
  // their next request finds an empty application and bounces them to the
  // sign-in page. Banning them in the auth service on top of that stops
  // their refresh token renewing and stops them signing in again.
  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: status === 'disabled' ? '876000h' : 'none',
    });
  } catch (banError) {
    console.error('could not update auth ban state', banError);
  }

  revalidatePath('/users');
  return { success: 'User updated.' };
}

'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/activity';
import { describeCredentialProblem, env } from '@/lib/env';
import { hashToken } from '@/lib/invitations';
import { text, type FormState } from '@/lib/forms';

const MIN_PASSWORD = 8;

/**
 * Account creation is the only thing that needs the service role key, so a
 * bad one shows up here and nowhere else — the rest of the app carries on
 * working, which makes it look like a signup bug rather than a
 * configuration one. Say what is actually wrong, on the form.
 */
function serviceKeyProblem(): string | null {
  return describeCredentialProblem(
    'SUPABASE_SERVICE_ROLE_KEY',
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

// -------------------------------------------------------------- sign up
/**
 * Creates the firm and its first Partner in one go. Runs with the service
 * role because there is no signed-in user yet; every later write in the
 * app goes through the user's own client and its policies.
 */
export async function signUpAction(_prev: FormState, data: FormData): Promise<FormState> {
  const firmName = text(data, 'firm_name');
  const fullName = text(data, 'full_name');
  const email = text(data, 'email').toLowerCase();
  const password = text(data, 'password');

  if (!firmName || !fullName || !email || !password) {
    return { error: 'Fill in every field.' };
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Choose a password of at least ${MIN_PASSWORD} characters.` };
  }

  const keyProblem = serviceKeyProblem();
  if (keyProblem) return { error: keyProblem };
  const admin = createAdminClient();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authError || !created.user) {
    return { error: authError?.message ?? 'Could not create that account.' };
  }

  const { data: firm, error: firmError } = await admin
    .from('firms')
    .insert({ name: firmName, email })
    .select('id')
    .single();
  if (firmError || !firm) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: firmError?.message ?? 'Could not create the firm.' };
  }

  const { error: profileError } = await admin.from('users').insert({
    id: created.user.id,
    firm_id: firm.id,
    full_name: fullName,
    email,
    role: 'partner',
    status: 'active',
  });
  if (profileError) {
    await admin.from('firms').delete().eq('id', firm.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  const supabase = createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return { success: 'Firm created. Sign in to continue.' };
  }

  await logActivity(supabase, {
    firmId: firm.id,
    userId: created.user.id,
    action: 'auth.login',
    entityType: 'user',
    entityId: created.user.id,
    detail: 'Firm signup',
  });

  redirect('/dashboard');
}

// --------------------------------------------------------------- log in
export async function signInAction(_prev: FormState, data: FormData): Promise<FormState> {
  const email = text(data, 'email').toLowerCase();
  const password = text(data, 'password');
  const next = text(data, 'next');

  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = createClient();
  const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !signIn.user) {
    return { error: 'Those details did not match an account.' };
  }

  // A disabled user must not get a working session. The database policies
  // would already return nothing for them, but ending the session here
  // makes the block obvious rather than an app full of empty pages.
  const { data: profile } = await supabase
    .from('users')
    .select('id, firm_id, status')
    .eq('id', signIn.user.id)
    .maybeSingle();

  if (!profile || profile.status !== 'active') {
    await supabase.auth.signOut();
    return { error: 'This account has been disabled. Speak to a partner at your firm.' };
  }

  await logActivity(supabase, {
    firmId: profile.firm_id,
    userId: profile.id,
    action: 'auth.login',
    entityType: 'user',
    entityId: profile.id,
  });

  redirect(next && next.startsWith('/') ? next : '/dashboard');
}

export async function signOutAction(): Promise<void> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const { data: profile } = await supabase
      .from('users')
      .select('id, firm_id')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (profile) {
      await logActivity(supabase, {
        firmId: profile.firm_id,
        userId: profile.id,
        action: 'auth.logout',
        entityType: 'user',
        entityId: profile.id,
      });
    }
  }
  await supabase.auth.signOut();
  redirect('/login');
}

// ------------------------------------------------------ forgot password
export async function forgotPasswordAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const email = text(data, 'email').toLowerCase();
  if (!email) return { error: 'Enter your email address.' };

  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password`,
  });

  // Always the same answer, so this cannot be used to discover which
  // addresses have accounts.
  return {
    success:
      'If that address belongs to an account, a reset link is on its way. The link expires in one hour.',
  };
}

export async function resetPasswordAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const password = text(data, 'password');
  const confirm = text(data, 'confirm_password');

  if (password.length < MIN_PASSWORD) {
    return { error: `Choose a password of at least ${MIN_PASSWORD} characters.` };
  }
  if (password !== confirm) return { error: 'The two passwords do not match.' };

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: 'This reset link has expired. Request a new one.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // Every other session belonging to this user is invalidated, so a
  // stolen session cannot outlive the reset.
  await supabase.auth.signOut({ scope: 'others' });

  const { data: profile } = await supabase
    .from('users')
    .select('id, firm_id')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (profile) {
    await logActivity(supabase, {
      firmId: profile.firm_id,
      userId: profile.id,
      action: 'auth.password_reset',
      entityType: 'user',
      entityId: profile.id,
    });
  }

  redirect('/dashboard');
}

// ---------------------------------------------------------- invitations
/** Redeems an invitation token and signs the new user straight in. */
export async function acceptInviteAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const token = text(data, 'token');
  const password = text(data, 'password');
  const confirm = text(data, 'confirm_password');

  if (!token) return { error: 'This invitation link is not valid.' };
  if (password.length < MIN_PASSWORD) {
    return { error: `Choose a password of at least ${MIN_PASSWORD} characters.` };
  }
  if (password !== confirm) return { error: 'The two passwords do not match.' };

  const keyProblem = serviceKeyProblem();
  if (keyProblem) return { error: keyProblem };
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from('invitations')
    .select('*')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (!invite || invite.accepted_at || invite.revoked_at) {
    return { error: 'This invitation has already been used or was withdrawn.' };
  }
  if (new Date(invite.expires_at) < new Date()) {
    return { error: 'This invitation has expired. Ask a partner to send a new one.' };
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: invite.full_name },
  });
  if (authError || !created.user) {
    return { error: authError?.message ?? 'Could not create that account.' };
  }

  const { error: profileError } = await admin.from('users').insert({
    id: created.user.id,
    firm_id: invite.firm_id,
    full_name: invite.full_name,
    email: invite.email,
    role: invite.role,
    status: 'active',
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  const supabase = createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });
  if (signInError) return { success: 'Your account is ready. Sign in to continue.' };

  redirect('/dashboard');
}

import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashToken } from '../../actions';
import { ROLE_LABELS } from '@/lib/labels';
import { Alert } from '@/components/ui/Alert';
import { AcceptInviteForm } from './AcceptInviteForm';

export const metadata = { title: 'Accept invitation · Wakili' };

export default async function InvitePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from('invitations')
    .select('id, email, full_name, role, expires_at, accepted_at, revoked_at, firm_id')
    .eq('token_hash', hashToken(params.token))
    .maybeSingle();

  const invalid =
    !invite || invite.accepted_at || invite.revoked_at || new Date(invite.expires_at) < new Date();

  if (invalid) {
    return (
      <>
        <h1 className="text-lg font-semibold text-ink-900">Invitation unavailable</h1>
        <div className="mt-4">
          <Alert tone="error">
            This invitation has expired, been withdrawn, or has already been used. Ask a partner at
            the firm to send you a new one.
          </Alert>
        </div>
        <p className="mt-6 text-sm">
          <Link href="/login" className="text-brand-700 hover:underline">Go to sign in</Link>
        </p>
      </>
    );
  }

  const { data: firm } = await admin
    .from('firms')
    .select('name')
    .eq('id', invite!.firm_id)
    .maybeSingle();

  return (
    <>
      <h1 className="text-lg font-semibold text-ink-900">Join {firm?.name ?? 'your firm'}</h1>
      <p className="mt-1 text-sm text-ink-600">
        {invite!.full_name} · {invite!.email} · {ROLE_LABELS[invite!.role as keyof typeof ROLE_LABELS]}
      </p>
      <AcceptInviteForm token={params.token} />
    </>
  );
}

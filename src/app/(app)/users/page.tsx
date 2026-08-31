import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { ROLE_LABELS } from '@/lib/labels';
import { formatDate } from '@/lib/dates';
import type { AppUser } from '@/lib/types';
import { InviteUserForm } from './InviteUserForm';
import { UserRow } from './UserRow';
import { revokeInviteAction } from './actions';

export const metadata = { title: 'Users · Wakili' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const { user, firm } = await requireRole('partner');
  const supabase = createClient();

  const [{ data: users }, { data: invitations }] = await Promise.all([
    supabase.from('users').select('*').eq('firm_id', firm.id).order('full_name'),
    supabase
      .from('invitations')
      .select('id, email, full_name, role, expires_at, created_at')
      .eq('firm_id', firm.id)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Invite colleagues, set what they can reach, and disable anyone who leaves."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="border-b border-ink-200 px-4 py-3 text-sm font-semibold text-ink-800">
            Firm users
          </h2>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="bg-ink-50">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Role</th>
                  <th className="th">Status</th>
                  <th className="th sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200">
                {(users as AppUser[] | null)?.map((u) => (
                  <UserRow key={u.id} user={u} isSelf={u.id === user.id} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="text-sm font-semibold text-ink-800">Invite someone</h2>
            <InviteUserForm />
          </section>

          <section className="card">
            <h2 className="border-b border-ink-200 px-4 py-3 text-sm font-semibold text-ink-800">
              Pending invitations
            </h2>
            {invitations && invitations.length > 0 ? (
              <ul className="divide-y divide-ink-200">
                {invitations.map((invite) => (
                  <li key={invite.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-800">
                        {invite.full_name}
                      </p>
                      <p className="truncate text-xs text-ink-500">{invite.email}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        <Badge>{ROLE_LABELS[invite.role as keyof typeof ROLE_LABELS]}</Badge>
                        <span className="ml-2">expires {formatDate(invite.expires_at)}</span>
                      </p>
                    </div>
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="invitation_id" value={invite.id} />
                      <button type="submit" className="text-xs text-red-700 hover:underline">
                        Withdraw
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-ink-500">No invitations outstanding.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

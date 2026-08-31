import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { FeeNoteStatusBadge, MatterStatusBadge } from '@/components/ui/StatusBadges';
import { EmptyState } from '@/components/ui/EmptyState';
import { CLIENT_TYPE_LABELS, PRACTICE_AREA_LABELS } from '@/lib/labels';
import { formatDate } from '@/lib/dates';
import { formatKes } from '@/lib/money';
import type { Client, FeeNote, Matter } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params }: { params: { id: string } }) {
  const { user } = await requireSession();
  const supabase = createClient();

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!client) notFound();

  const record = client as Client;
  const showMoney = can(user.role).seeMoney;

  // Only the matters this user is allowed to see come back; the policy
  // does the filtering, not this query.
  const { data: matters } = await supabase
    .from('matters')
    .select('id, file_reference, title, practice_area, status, court_case_number, date_opened')
    .eq('client_id', record.id)
    .is('deleted_at', null)
    .order('date_opened', { ascending: false });

  let feeNotes: FeeNote[] = [];
  if (showMoney) {
    const { data } = await supabase
      .from('fee_notes')
      .select('*')
      .eq('client_id', record.id)
      .neq('status', 'paid')
      .order('created_at', { ascending: false });
    feeNotes = (data ?? []) as FeeNote[];
  }

  const outstanding = feeNotes
    .filter((note) => note.status !== 'draft')
    .reduce((sum, note) => sum + (note.total - note.amount_paid), 0);

  return (
    <>
      <PageHeader
        title={record.full_name}
        subtitle={`${CLIENT_TYPE_LABELS[record.type]} · client since ${formatDate(record.created_at)}`}
        actions={
          <>
            {can(user.role).createMatters ? (
              <Link href={`/matters/new?client=${record.id}`} className="btn-secondary">
                Open a matter
              </Link>
            ) : null}
            {can(user.role).createClients ? (
              <Link href={`/clients/${record.id}/edit`} className="btn-primary">Edit</Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-ink-800">Contact details</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <Detail label={record.type === 'company' ? 'Registration no.' : 'ID number'}
                    value={record.id_number} />
            <Detail label="KRA PIN" value={record.kra_pin} />
            <Detail label="Phone" value={record.phone} />
            <Detail label="Email" value={record.email} />
            <Detail label="Physical address" value={record.physical_address} />
            <Detail label="Notes" value={record.notes} />
          </dl>
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="border-b border-ink-200 px-4 py-3 text-sm font-semibold text-ink-800">
              Matters
            </h2>
            {matters && matters.length > 0 ? (
              <ul className="divide-y divide-ink-200">
                {(matters as Matter[]).map((matter) => (
                  <li key={matter.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/matters/${matter.id}`}
                            className="font-medium text-brand-700 hover:underline">
                        {matter.file_reference} — {matter.title}
                      </Link>
                      <MatterStatusBadge status={matter.status} />
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {PRACTICE_AREA_LABELS[matter.practice_area]}
                      {matter.court_case_number ? ` · ${matter.court_case_number}` : ''}
                      {` · opened ${formatDate(matter.date_opened)}`}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No matters on this client yet" />
            )}
          </section>

          {/* Clerks never see this section, and the fee_notes policies
              return nothing for them even if they reach the URL. */}
          {showMoney ? (
            <section className="card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-ink-800">Outstanding fee notes</h2>
                <Badge tone={outstanding > 0 ? 'amber' : 'green'}>
                  {formatKes(outstanding)} outstanding
                </Badge>
              </div>
              {feeNotes.length > 0 ? (
                <ul className="divide-y divide-ink-200">
                  {feeNotes.map((note) => (
                    <li key={note.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div>
                        <Link href={`/fee-notes/${note.id}`}
                              className="font-medium text-brand-700 hover:underline">
                          {note.fee_note_number}
                        </Link>
                        <p className="text-xs text-ink-500">Raised {formatDate(note.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatKes(note.total - note.amount_paid)}</p>
                        <FeeNoteStatusBadge status={note.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nothing outstanding" description="Every fee note for this client is settled." />
              )}
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-ink-800">{value || '—'}</dd>
    </div>
  );
}

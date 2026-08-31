import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Pagination, pageFromParams, rangeFor } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeeNoteStatusBadge } from '@/components/ui/StatusBadges';
import { FEE_NOTE_STATUS_LABELS, entries } from '@/lib/labels';
import { formatDate } from '@/lib/dates';
import { formatKes } from '@/lib/money';
import type { FeeNoteStatus } from '@/lib/types';

export const metadata = { title: 'Fee notes · Wakili' };
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  fee_note_number: string | null;
  total: number;
  amount_paid: number;
  status: FeeNoteStatus;
  created_at: string;
  clients: { id: string; full_name: string } | null;
  matters: { id: string; file_reference: string; title: string } | null;
}

export default async function FeeNotesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  const { user } = await requireSession();
  if (!can(user.role).seeMoney) notFound();

  const supabase = createClient();
  const page = pageFromParams(searchParams.page);
  const [from, to] = rangeFor(page);

  let query = supabase
    .from('fee_notes')
    .select(
      'id, fee_note_number, total, amount_paid, status, created_at,' +
        ' clients:client_id (id, full_name), matters:matter_id (id, file_reference, title)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchParams.q) query = query.ilike('fee_note_number', `%${searchParams.q}%`);
  if (searchParams.status) query = query.eq('status', searchParams.status);

  const { data, count } = await query;
  const feeNotes = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title="Fee notes"
        subtitle="Everything the firm has billed on the matters you can see."
        actions={<Link href="/fee-notes/new" className="btn-primary">New fee note</Link>}
      />

      <div className="card">
        <FilterBar
          searchPlaceholder="Fee note number"
          selects={[
            {
              name: 'status',
              label: 'Status',
              options: entries(FEE_NOTE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
            },
          ]}
        />

        {feeNotes.length === 0 ? (
          <EmptyState title="No fee notes yet" description="Raise one from a matter." />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead className="bg-ink-50">
                <tr>
                  <th className="th">Number</th>
                  <th className="th">Client</th>
                  <th className="th">Matter</th>
                  <th className="th">Total</th>
                  <th className="th">Balance</th>
                  <th className="th">Status</th>
                  <th className="th">Raised</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200">
                {feeNotes.map((note) => (
                  <tr key={note.id} className="hover:bg-ink-50">
                    <td className="td">
                      <Link href={`/fee-notes/${note.id}`}
                            className="font-medium text-brand-700 hover:underline">
                        {note.fee_note_number}
                      </Link>
                    </td>
                    <td className="td">{note.clients?.full_name ?? '—'}</td>
                    <td className="td">
                      {note.matters ? (
                        <Link href={`/matters/${note.matters.id}`} className="hover:underline">
                          {note.matters.file_reference}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="td whitespace-nowrap">{formatKes(note.total)}</td>
                    <td className="td whitespace-nowrap">
                      {formatKes(note.total - note.amount_paid)}
                    </td>
                    <td className="td"><FeeNoteStatusBadge status={note.status} /></td>
                    <td className="td whitespace-nowrap">{formatDate(note.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} total={count ?? 0} basePath="/fee-notes"
                    params={{ q: searchParams.q, status: searchParams.status }} />
      </div>
    </>
  );
}

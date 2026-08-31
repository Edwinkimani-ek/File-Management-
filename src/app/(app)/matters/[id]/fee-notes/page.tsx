import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { canWriteToMatter, loadMatter } from '@/lib/matters';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeeNoteStatusBadge } from '@/components/ui/StatusBadges';
import { formatDate } from '@/lib/dates';
import { formatKes } from '@/lib/money';
import type { FeeNoteStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MatterFeeNotesPage({ params }: { params: { id: string } }) {
  const { user } = await requireSession();
  // The tab is hidden from clerks; reaching it by URL finds nothing either.
  if (!can(user.role).seeMoney) notFound();

  const matter = await loadMatter(params.id);
  const supabase = createClient();

  const { data } = await supabase
    .from('fee_notes')
    .select('id, fee_note_number, total, amount_paid, status, created_at')
    .eq('matter_id', matter.id)
    .order('created_at', { ascending: false });

  const feeNotes = (data ?? []) as {
    id: string;
    fee_note_number: string | null;
    total: number;
    amount_paid: number;
    status: FeeNoteStatus;
    created_at: string;
  }[];

  const billed = feeNotes
    .filter((note) => note.status !== 'draft')
    .reduce((sum, note) => sum + note.total, 0);
  const outstanding = feeNotes
    .filter((note) => note.status !== 'draft')
    .reduce((sum, note) => sum + (note.total - note.amount_paid), 0);

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-800">Fee notes on this file</h2>
          <p className="text-xs text-ink-500">
            {formatKes(billed)} billed · {formatKes(outstanding)} outstanding
          </p>
        </div>
        {canWriteToMatter(matter, user.role) ? (
          <Link href={`/fee-notes/new?matter=${matter.id}`} className="btn-primary">
            New fee note
          </Link>
        ) : null}
      </div>

      {feeNotes.length === 0 ? (
        <EmptyState title="Nothing billed on this file yet" />
      ) : (
        <ul className="divide-y divide-ink-200">
          {feeNotes.map((note) => (
            <li key={note.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <Link href={`/fee-notes/${note.id}`}
                      className="font-medium text-brand-700 hover:underline">
                  {note.fee_note_number}
                </Link>
                <p className="text-xs text-ink-500">Raised {formatDate(note.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-ink-900">{formatKes(note.total)}</p>
                <FeeNoteStatusBadge status={note.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

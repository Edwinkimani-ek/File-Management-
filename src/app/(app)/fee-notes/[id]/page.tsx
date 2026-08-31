import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { FeeNoteStatusBadge } from '@/components/ui/StatusBadges';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeeNoteForm } from '@/components/fees/FeeNoteForm';
import { FeeNoteWorkflow, RecordPaymentForm } from '@/components/fees/FeeNoteWorkflow';
import { PAYMENT_METHOD_LABELS } from '@/lib/labels';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatKes } from '@/lib/money';
import type { FeeNote, Payment } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function FeeNotePage({ params }: { params: { id: string } }) {
  const { user, firm } = await requireSession();
  // A clerk has no select policy on fee_notes, so this page 404s for them
  // whether they arrive by link or by typing the URL.
  if (!can(user.role).seeMoney) notFound();

  const supabase = createClient();
  const { data } = await supabase
    .from('fee_notes')
    .select(
      '*, clients:client_id (id, full_name),' +
        ' matters:matter_id (id, file_reference, title),' +
        ' creator:created_by (full_name), approver:approved_by (full_name)',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!data) notFound();

  const feeNote = data as unknown as FeeNote & {
    clients: { id: string; full_name: string } | null;
    matters: { id: string; file_reference: string; title: string } | null;
    creator: { full_name: string } | null;
    approver: { full_name: string } | null;
  };

  const { data: paymentRows } = await supabase
    .from('payments')
    .select('*, recorder:recorded_by (full_name)')
    .eq('fee_note_id', feeNote.id)
    .order('payment_date', { ascending: false });

  const payments = (paymentRows ?? []) as unknown as (Payment & {
    recorder: { full_name: string } | null;
  })[];

  const isPartner = can(user.role).approveFeeNotes;
  const balance = feeNote.total - feeNote.amount_paid;
  const editable = feeNote.status === 'draft';

  return (
    <>
      <div className="mb-4">
        <Link href="/fee-notes" className="text-sm text-ink-600 hover:underline">
          ← All fee notes
        </Link>
      </div>

      <PageHeader
        title={feeNote.fee_note_number ?? 'Fee note'}
        subtitle={
          feeNote.matters
            ? `${feeNote.matters.file_reference} — ${feeNote.matters.title}`
            : undefined
        }
        actions={
          <a className="btn-secondary" href={`/api/fee-notes/${feeNote.id}/pdf`} target="_blank"
             rel="noreferrer">
            Download PDF
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {editable ? (
            <FeeNoteForm feeNote={feeNote} vatRateBp={firm.vat_rate_bp} />
          ) : (
            <section className="card p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-ink-800">Particulars</h2>
              <ul className="mt-3 divide-y divide-ink-200">
                {feeNote.line_items.map((item, index) => (
                  <li key={index} className="flex justify-between gap-4 py-2 text-sm">
                    <span className="text-ink-800">{item.description}</span>
                    <span className="whitespace-nowrap text-ink-900">{formatKes(item.amount)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-1 border-t border-ink-200 pt-3 text-sm">
                <Line label="Subtotal" value={formatKes(feeNote.subtotal)} />
                {feeNote.vat_applicable ? (
                  <Line label="VAT" value={formatKes(feeNote.vat_amount)} />
                ) : null}
                <Line label="Total" value={formatKes(feeNote.total)} emphasised />
                {feeNote.amount_paid > 0 ? (
                  <>
                    <Line label="Paid" value={formatKes(feeNote.amount_paid)} />
                    <Line label="Balance" value={formatKes(balance)} emphasised />
                  </>
                ) : null}
              </dl>
              {feeNote.notes ? (
                <p className="mt-4 whitespace-pre-wrap border-t border-ink-200 pt-3 text-sm text-ink-600">
                  {feeNote.notes}
                </p>
              ) : null}
            </section>
          )}

          <section className="card">
            <h2 className="border-b border-ink-200 px-4 py-3 text-sm font-semibold text-ink-800">
              Payments
            </h2>
            {payments.length > 0 ? (
              <ul className="divide-y divide-ink-200">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink-900">
                        {formatKes(payment.amount)}
                      </p>
                      <p className="text-xs text-ink-500">
                        {PAYMENT_METHOD_LABELS[payment.method]}
                        {payment.reference ? ` · ${payment.reference}` : ''}
                        {` · ${formatDate(payment.payment_date)}`}
                        {payment.recorder ? ` · recorded by ${payment.recorder.full_name}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No payments recorded yet" />
            )}

            {feeNote.status !== 'draft' && balance > 0 ? (
              <div className="border-t border-ink-200">
                <RecordPaymentForm feeNoteId={feeNote.id} balance={balance} />
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-800">Status</h2>
              <FeeNoteStatusBadge status={feeNote.status} />
            </div>
            <div className="mt-4">
              <FeeNoteWorkflow feeNoteId={feeNote.id} status={feeNote.status} isPartner={isPartner} />
            </div>
          </section>

          <section className="card p-4 text-sm">
            <h2 className="mb-3 text-sm font-semibold text-ink-800">Details</h2>
            <dl className="space-y-3">
              <Detail label="Client">
                {feeNote.clients ? (
                  <Link href={`/clients/${feeNote.clients.id}`} className="text-brand-700 hover:underline">
                    {feeNote.clients.full_name}
                  </Link>
                ) : '—'}
              </Detail>
              <Detail label="Raised">
                {formatDateTime(feeNote.created_at)}
                {feeNote.creator ? ` by ${feeNote.creator.full_name}` : ''}
              </Detail>
              {feeNote.approved_at ? (
                <Detail label="Approved">
                  {formatDateTime(feeNote.approved_at)}
                  {feeNote.approver ? ` by ${feeNote.approver.full_name}` : ''}
                </Detail>
              ) : null}
              {feeNote.sent_at ? (
                <Detail label="Sent">{formatDateTime(feeNote.sent_at)}</Detail>
              ) : null}
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}

function Line({ label, value, emphasised }: { label: string; value: string; emphasised?: boolean }) {
  return (
    <div className={`flex justify-between ${emphasised ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-ink-800">{children}</dd>
    </div>
  );
}

import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeeNoteStatusBadge } from '@/components/ui/StatusBadges';
import { formatDate, todayInNairobi } from '@/lib/dates';
import { formatKes } from '@/lib/money';
import type { FeeNoteStatus } from '@/lib/types';

export const metadata = { title: 'Reports · Wakili' };
export const dynamic = 'force-dynamic';

interface UnpaidRow {
  id: string;
  fee_note_number: string | null;
  total: number;
  amount_paid: number;
  status: FeeNoteStatus;
  created_at: string;
  clients: { id: string; full_name: string } | null;
  matters: { id: string; file_reference: string; title: string } | null;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  await requireRole('partner');
  const supabase = createClient();

  const today = todayInNairobi();
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? '')
    ? searchParams.month!
    : today.slice(0, 7);
  const [monthStart, monthEnd] = monthBounds(month);

  const [{ data: unpaidRows }, { data: monthPayments }, { data: monthNotes }] = await Promise.all([
    supabase
      .from('fee_notes')
      .select(
        'id, fee_note_number, total, amount_paid, status, created_at,' +
          ' clients:client_id (id, full_name), matters:matter_id (id, file_reference, title)',
      )
      .in('status', ['approved', 'sent', 'partially_paid'])
      .order('created_at'),
    supabase
      .from('payments')
      .select('amount, method, payment_date')
      .gte('payment_date', monthStart)
      .lte('payment_date', monthEnd),
    supabase
      .from('fee_notes')
      .select('total, status, created_at')
      .gte('created_at', `${monthStart}T00:00:00Z`)
      .lte('created_at', `${monthEnd}T23:59:59Z`),
  ]);

  const unpaid = (unpaidRows ?? []) as unknown as UnpaidRow[];
  const outstandingTotal = unpaid.reduce((sum, n) => sum + (n.total - n.amount_paid), 0);

  const collected = (monthPayments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const billed = (monthNotes ?? [])
    .filter((n) => n.status !== 'draft')
    .reduce((sum, n) => sum + n.total, 0);

  const byClient = groupTotals(unpaid, (row) => ({
    key: row.clients?.id ?? 'none',
    label: row.clients?.full_name ?? 'Unknown client',
    href: row.clients ? `/clients/${row.clients.id}` : undefined,
  }));

  const byMatter = groupTotals(unpaid, (row) => ({
    key: row.matters?.id ?? 'none',
    label: row.matters ? `${row.matters.file_reference} — ${row.matters.title}` : 'Unknown matter',
    href: row.matters ? `/matters/${row.matters.id}` : undefined,
  }));

  const [prevMonth, nextMonth] = monthNeighbours(month);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Money owed to the firm, and what came in this month."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Outstanding" value={formatKes(outstandingTotal)} />
        <Stat label={`Billed in ${monthLabel(month)}`} value={formatKes(billed)} />
        <Stat label={`Received in ${monthLabel(month)}`} value={formatKes(collected)} />
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Link href={`/reports?month=${prevMonth}`} className="btn-secondary">←</Link>
        <span className="text-sm font-medium text-ink-700">{monthLabel(month)}</span>
        <Link href={`/reports?month=${nextMonth}`} className="btn-secondary">→</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TotalsCard title="Outstanding by client" rows={byClient} />
        <TotalsCard title="Outstanding by matter" rows={byMatter} />
      </div>

      <section className="card mt-6">
        <h2 className="border-b border-ink-200 px-4 py-3 text-sm font-semibold text-ink-800">
          Unpaid fee notes
        </h2>
        {unpaid.length === 0 ? (
          <EmptyState title="Nothing outstanding" description="Every issued fee note is settled." />
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
                {unpaid.map((note) => (
                  <tr key={note.id} className="hover:bg-ink-50">
                    <td className="td">
                      <Link href={`/fee-notes/${note.id}`}
                            className="font-medium text-brand-700 hover:underline">
                        {note.fee_note_number}
                      </Link>
                    </td>
                    <td className="td">{note.clients?.full_name ?? '—'}</td>
                    <td className="td">{note.matters?.file_reference ?? '—'}</td>
                    <td className="td whitespace-nowrap">{formatKes(note.total)}</td>
                    <td className="td whitespace-nowrap font-medium">
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
      </section>
    </>
  );
}

interface TotalRow {
  key: string;
  label: string;
  href?: string;
  amount: number;
}

function groupTotals(
  rows: UnpaidRow[],
  pick: (row: UnpaidRow) => { key: string; label: string; href?: string },
): TotalRow[] {
  const map = new Map<string, TotalRow>();
  for (const row of rows) {
    const { key, label, href } = pick(row);
    const existing = map.get(key);
    const amount = row.total - row.amount_paid;
    if (existing) existing.amount += amount;
    else map.set(key, { key, label, href, amount });
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

function TotalsCard({ title, rows }: { title: string; rows: TotalRow[] }) {
  return (
    <section className="card">
      <h2 className="border-b border-ink-200 px-4 py-3 text-sm font-semibold text-ink-800">
        {title}
      </h2>
      {rows.length === 0 ? (
        <EmptyState title="Nothing outstanding" />
      ) : (
        <ul className="divide-y divide-ink-200">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              {row.href ? (
                <Link href={row.href} className="min-w-0 truncate text-brand-700 hover:underline">
                  {row.label}
                </Link>
              ) : (
                <span className="min-w-0 truncate">{row.label}</span>
              )}
              <span className="whitespace-nowrap font-medium">{formatKes(row.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function monthBounds(month: string): [string, string] {
  const [year, monthNumber] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`];
}

function monthNeighbours(month: string): [string, string] {
  const [year, monthNumber] = month.split('-').map(Number);
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return [
    fmt(new Date(Date.UTC(year, monthNumber - 2, 1))),
    fmt(new Date(Date.UTC(year, monthNumber, 1))),
  ];
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

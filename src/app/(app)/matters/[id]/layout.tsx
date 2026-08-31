import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { loadMatter } from '@/lib/matters';
import { MatterTabs } from '@/components/matter/MatterTabs';
import { CloseMatterPanel, ReopenMatterButton } from '@/components/matter/CloseMatterPanel';
import { MatterStatusBadge } from '@/components/ui/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { PRACTICE_AREA_LABELS, VISIBILITY_LABELS } from '@/lib/labels';
import { formatDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function MatterLayout({
  params,
  children,
}: {
  params: { id: string };
  children: React.ReactNode;
}) {
  const { user } = await requireSession();
  const matter = await loadMatter(params.id);
  const permissions = can(user.role);
  const isClosed = matter.status === 'closed';
  const canEdit = permissions.createMatters && (!isClosed || user.role === 'partner');

  return (
    <>
      <div className="mb-4">
        <Link href="/matters" className="text-sm text-ink-600 hover:underline">
          ← All matters
        </Link>
      </div>

      <header className="card mb-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-ink-900 sm:text-xl">
                {matter.file_reference}
              </h1>
              <MatterStatusBadge status={matter.status} />
              {matter.visibility === 'firm_wide' ? (
                <Badge tone="blue">{VISIBILITY_LABELS.firm_wide}</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-ink-700">{matter.title}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Link href={`/matters/${matter.id}/edit`} className="btn-secondary">Edit</Link>
            ) : null}
            {!isClosed && permissions.closeMatters ? (
              <CloseMatterPanel matterId={matter.id} />
            ) : null}
            {isClosed && user.role === 'partner' ? (
              <ReopenMatterButton matterId={matter.id} />
            ) : null}
          </div>
        </div>

        <dl className="mt-5 grid gap-4 border-t border-ink-200 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Client">
            {matter.clients ? (
              <Link href={`/clients/${matter.clients.id}`} className="text-brand-700 hover:underline">
                {matter.clients.full_name}
              </Link>
            ) : '—'}
          </Field>
          <Field label="Opposing party">{matter.opposing_party || '—'}</Field>
          <Field label="Opposing advocates">{matter.opposing_advocates || '—'}</Field>
          <Field label="Practice area">{PRACTICE_AREA_LABELS[matter.practice_area]}</Field>
          <Field label="Court station">{matter.court_station || '—'}</Field>
          <Field label="Court case number">{matter.court_case_number || 'Not yet filed'}</Field>
          <Field label="Assigned advocate">{matter.assignee?.full_name ?? 'Unassigned'}</Field>
          <Field label="Opened">
            {formatDate(matter.date_opened)}
            {matter.date_closed ? ` · closed ${formatDate(matter.date_closed)}` : ''}
          </Field>
        </dl>

        {matter.description ? (
          <p className="mt-4 whitespace-pre-wrap border-t border-ink-200 pt-4 text-sm text-ink-700">
            {matter.description}
          </p>
        ) : null}

        {isClosed && matter.closing_note ? (
          <div className="mt-4">
            <Alert tone="info" title="Closing note">{matter.closing_note}</Alert>
          </div>
        ) : null}
      </header>

      <MatterTabs matterId={matter.id} showFeeNotes={permissions.seeMoney} />
      <div className="pt-6">{children}</div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 break-words text-ink-800">{children}</dd>
    </div>
  );
}

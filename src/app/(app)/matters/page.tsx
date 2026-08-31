import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Pagination, pageFromParams, rangeFor } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { MatterStatusBadge } from '@/components/ui/StatusBadges';
import { MATTER_STATUS_LABELS, PRACTICE_AREA_LABELS, entries } from '@/lib/labels';
import { formatDate } from '@/lib/dates';

export const metadata = { title: 'Matters · Wakili' };
export const dynamic = 'force-dynamic';

interface MatterRow {
  id: string;
  file_reference: string;
  title: string;
  practice_area: keyof typeof PRACTICE_AREA_LABELS;
  status: 'active' | 'dormant' | 'closed';
  court_case_number: string | null;
  court_station: string | null;
  date_opened: string;
  clients: { id: string; full_name: string } | null;
  assignee: { id: string; full_name: string } | null;
}

export default async function MattersPage({
  searchParams,
}: {
  searchParams: {
    q?: string; status?: string; practice_area?: string; assigned_to?: string; page?: string;
  };
}) {
  const { user, firm } = await requireSession();
  const supabase = createClient();
  const page = pageFromParams(searchParams.page);
  const [from, to] = rangeFor(page);

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('firm_id', firm.id)
    .eq('status', 'active')
    .order('full_name');

  // Client-name search needs the matching client ids first; PostgREST
  // cannot put an embedded column inside an .or() filter.
  let clientIds: string[] = [];
  if (searchParams.q) {
    const { data: matchedClients } = await supabase
      .from('clients')
      .select('id')
      .ilike('full_name', `%${searchParams.q}%`)
      .limit(200);
    clientIds = (matchedClients ?? []).map((c) => c.id);
  }

  let query = supabase
    .from('matters')
    .select(
      'id, file_reference, title, practice_area, status, court_case_number, court_station, date_opened,' +
        ' clients:client_id (id, full_name), assignee:assigned_to (id, full_name)',
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('date_opened', { ascending: false })
    .range(from, to);

  if (searchParams.q) {
    const term = `%${searchParams.q}%`;
    const filters = [
      `title.ilike.${term}`,
      `file_reference.ilike.${term}`,
      `court_case_number.ilike.${term}`,
      `opposing_party.ilike.${term}`,
    ];
    if (clientIds.length > 0) filters.push(`client_id.in.(${clientIds.join(',')})`);
    query = query.or(filters.join(','));
  }
  if (searchParams.status) query = query.eq('status', searchParams.status);
  if (searchParams.practice_area) query = query.eq('practice_area', searchParams.practice_area);
  if (searchParams.assigned_to) query = query.eq('assigned_to', searchParams.assigned_to);

  const { data, count } = await query;
  const matters = (data ?? []) as unknown as MatterRow[];

  return (
    <>
      <PageHeader
        title="Matters"
        subtitle={
          user.role === 'partner'
            ? 'Every file in the firm.'
            : 'Files assigned to you, plus anything the firm has marked firm-wide.'
        }
        actions={
          can(user.role).createMatters ? (
            <Link href="/matters/new" className="btn-primary">New matter</Link>
          ) : null
        }
      />

      <div className="card">
        <FilterBar
          searchPlaceholder="Title, file ref, court number, client or opposing party"
          selects={[
            {
              name: 'status',
              label: 'Status',
              options: entries(MATTER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
            },
            {
              name: 'practice_area',
              label: 'Practice area',
              options: entries(PRACTICE_AREA_LABELS).map(([value, label]) => ({ value, label })),
            },
            {
              name: 'assigned_to',
              label: 'Advocate',
              options: (users ?? []).map((u) => ({ value: u.id, label: u.full_name })),
            },
          ]}
        />

        {matters.length === 0 ? (
          <EmptyState
            title="No matters found"
            description={
              searchParams.q
                ? 'Nothing matched that search.'
                : 'Open your first matter to start using the file.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead className="bg-ink-50">
                <tr>
                  <th className="th">File</th>
                  <th className="th">Client</th>
                  <th className="th">Practice area</th>
                  <th className="th">Advocate</th>
                  <th className="th">Status</th>
                  <th className="th">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200">
                {matters.map((matter) => (
                  <tr key={matter.id} className="hover:bg-ink-50">
                    <td className="td">
                      <Link href={`/matters/${matter.id}`}
                            className="font-medium text-brand-700 hover:underline">
                        {matter.file_reference}
                      </Link>
                      <p className="text-ink-700">{matter.title}</p>
                      {matter.court_case_number ? (
                        <p className="text-xs text-ink-500">{matter.court_case_number}</p>
                      ) : null}
                    </td>
                    <td className="td">{matter.clients?.full_name ?? '—'}</td>
                    <td className="td">{PRACTICE_AREA_LABELS[matter.practice_area]}</td>
                    <td className="td">{matter.assignee?.full_name ?? 'Unassigned'}</td>
                    <td className="td"><MatterStatusBadge status={matter.status} /></td>
                    <td className="td whitespace-nowrap">{formatDate(matter.date_opened)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          total={count ?? 0}
          basePath="/matters"
          params={{
            q: searchParams.q,
            status: searchParams.status,
            practice_area: searchParams.practice_area,
            assigned_to: searchParams.assigned_to,
          }}
        />
      </div>
    </>
  );
}

import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Pagination, pageFromParams, rangeFor } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { CLIENT_TYPE_LABELS } from '@/lib/labels';
import { formatDate } from '@/lib/dates';
import type { Client } from '@/lib/types';

export const metadata = { title: 'Clients · Wakili' };
export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; page?: string };
}) {
  const { user } = await requireSession();
  const supabase = createClient();
  const page = pageFromParams(searchParams.page);
  const [from, to] = rangeFor(page);

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('full_name')
    .range(from, to);

  if (searchParams.q) {
    const term = `%${searchParams.q}%`;
    query = query.or(
      `full_name.ilike.${term},id_number.ilike.${term},phone.ilike.${term},email.ilike.${term}`,
    );
  }
  if (searchParams.type === 'individual' || searchParams.type === 'company') {
    query = query.eq('type', searchParams.type);
  }

  const { data, count } = await query;
  const clients = (data ?? []) as Client[];

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Everyone the firm acts for."
        actions={
          can(user.role).createClients ? (
            <Link href="/clients/new" className="btn-primary">New client</Link>
          ) : null
        }
      />

      <div className="card">
        <FilterBar
          searchPlaceholder="Name, ID number, phone or email"
          selects={[
            {
              name: 'type',
              label: 'Type',
              options: [
                { value: 'individual', label: CLIENT_TYPE_LABELS.individual },
                { value: 'company', label: CLIENT_TYPE_LABELS.company },
              ],
            },
          ]}
        />

        {clients.length === 0 ? (
          <EmptyState
            title="No clients found"
            description={
              searchParams.q
                ? 'Nothing matched that search. Try a shorter term.'
                : 'Add the firm’s clients to start opening matters against them.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead className="bg-ink-50">
                <tr>
                  <th className="th">Client</th>
                  <th className="th">Type</th>
                  <th className="th">ID / Reg. no.</th>
                  <th className="th">Phone</th>
                  <th className="th">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-ink-50">
                    <td className="td">
                      <Link href={`/clients/${client.id}`} className="font-medium text-brand-700 hover:underline">
                        {client.full_name}
                      </Link>
                      {client.email ? (
                        <p className="text-xs text-ink-500">{client.email}</p>
                      ) : null}
                    </td>
                    <td className="td"><Badge>{CLIENT_TYPE_LABELS[client.type]}</Badge></td>
                    <td className="td">{client.id_number ?? '—'}</td>
                    <td className="td">{client.phone ?? '—'}</td>
                    <td className="td">{formatDate(client.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          total={count ?? 0}
          basePath="/clients"
          params={{ q: searchParams.q, type: searchParams.type }}
        />
      </div>
    </>
  );
}

import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Pagination, pageFromParams, rangeFor } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/dates';
import { formatBytes } from '@/lib/uploads';
import { DuplicateTemplateForm } from './DuplicateTemplateForm';
import { DeleteTemplateForm } from './DeleteTemplateForm';
import type { Template } from '@/lib/types';

export const metadata = { title: 'Templates · Wakili' };
export const dynamic = 'force-dynamic';

interface TemplateRow extends Template {
  creator: { full_name: string } | null;
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: { q?: string; starter?: string; page?: string };
}) {
  const { user } = await requireSession();
  const isPartner = can(user.role).manageTemplates;
  const supabase = createClient();
  const page = pageFromParams(searchParams.page);
  const [from, to] = rangeFor(page);

  let query = supabase
    .from('templates')
    .select(
      'id, name, description, file_name, storage_path, mime_type, size_bytes,' +
        ' placeholders, is_starter, created_by, created_at,' +
        ' creator:created_by (full_name)',
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('is_starter', { ascending: false })
    .order('name')
    .range(from, to);

  if (searchParams.q) {
    query = query.ilike('name', `%${searchParams.q}%`);
  }
  if (searchParams.starter === '1') {
    query = query.eq('is_starter', true);
  }

  const { data, count } = await query;
  const templates = (data ?? []) as unknown as TemplateRow[];

  return (
    <>
      <PageHeader
        title="Document templates"
        subtitle="Standard documents for the firm."
        actions={
          isPartner ? (
            <Link href="/templates/new" className="btn-primary">
              Upload template
            </Link>
          ) : null
        }
      />

      <div className="card">
        <FilterBar
          searchPlaceholder="Template name"
          selects={[
            {
              name: 'starter',
              label: 'Type',
              options: [
                { value: '1', label: 'Starter templates' },
              ],
            },
          ]}
        />

        {templates.length === 0 ? (
          <EmptyState
            title="No templates yet"
            description={
              isPartner
                ? 'Upload the firm’s standard Word documents and turn bracketed text into placeholders.'
                : 'The firm has not published any templates yet.'
            }
          />
        ) : (
          <ul className="divide-y divide-ink-200">
            {templates.map((template) => (
              <li key={template.id} className="px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/templates/${template.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {template.name}
                      </Link>
                      {template.is_starter ? (
                        <Badge tone="blue">Starter</Badge>
                      ) : null}
                    </div>
                    {template.description ? (
                      <p className="mt-1 text-sm text-ink-600">{template.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-ink-500">
                      {template.file_name} · {formatBytes(template.size_bytes)}
                      {' · '}uploaded {formatDate(template.created_at)}
                      {template.creator ? ` by ${template.creator.full_name}` : ''}
                    </p>
                    {template.placeholders.length > 0 ? (
                      <p className="mt-2 text-xs text-ink-500">
                        Placeholders:{' '}
                        {template.placeholders.map((p) => p.label).join(', ')}
                      </p>
                    ) : null}
                  </div>

                  {isPartner ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link
                        href={`/templates/${template.id}/setup`}
                        className="btn-secondary"
                      >
                        Set up
                      </Link>
                      <DuplicateTemplateForm templateId={template.id} />
                      <DeleteTemplateForm templateId={template.id} name={template.name} />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <Pagination
          page={page}
          total={count ?? 0}
          basePath="/templates"
          params={{ q: searchParams.q, starter: searchParams.starter }}
        />
      </div>
    </>
  );
}

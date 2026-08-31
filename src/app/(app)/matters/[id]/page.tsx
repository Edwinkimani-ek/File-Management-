import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { canWriteToMatter, loadMatter } from '@/lib/matters';
import { DocumentUpload } from '@/components/matter/DocumentUpload';
import { DocumentList, type DocumentRow } from '@/components/matter/DocumentList';
import { Alert } from '@/components/ui/Alert';
import { FilterBar } from '@/components/ui/FilterBar';
import { DOCUMENT_CATEGORY_LABELS, entries } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function MatterDocumentsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { category?: string; q?: string; sort?: string };
}) {
  const { user } = await requireSession();
  const matter = await loadMatter(params.id);
  const supabase = createClient();

  const canUpload = canWriteToMatter(matter, user.role);
  const ascending = searchParams.sort === 'oldest';

  let query = supabase
    .from('documents')
    .select('id, file_name, category, mime_type, size_bytes, uploaded_at, notes,' +
            ' uploader:uploaded_by (full_name)')
    .eq('matter_id', matter.id)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending });

  if (searchParams.category) query = query.eq('category', searchParams.category);
  if (searchParams.q) query = query.ilike('file_name', `%${searchParams.q}%`);

  const { data } = await query;
  const documents = (data ?? []) as unknown as DocumentRow[];

  return (
    <div className="space-y-6">
      {!canUpload ? (
        <Alert tone="info" title="This matter is closed">
          The file is read-only. A partner can reopen it if something else has to go in.
        </Alert>
      ) : null}

      <section className="card">
        <h2 className="border-b border-ink-200 px-4 py-3 text-sm font-semibold text-ink-800">
          Documents
        </h2>

        {canUpload ? <DocumentUpload matterId={matter.id} /> : null}

        <FilterBar
          searchPlaceholder="File name"
          selects={[
            {
              name: 'category',
              label: 'Category',
              options: entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
            },
            {
              name: 'sort',
              label: 'Sort',
              options: [
                { value: 'newest', label: 'Newest first' },
                { value: 'oldest', label: 'Oldest first' },
              ],
            },
          ]}
        />

        <DocumentList
          documents={documents}
          matterId={matter.id}
          canEdit={canUpload}
          canDelete={can(user.role).deleteRecords}
        />
      </section>
    </div>
  );
}

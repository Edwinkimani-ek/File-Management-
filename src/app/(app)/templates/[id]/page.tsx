import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { formatDate } from '@/lib/dates';
import { formatBytes } from '@/lib/uploads';
import { EditTemplateForm } from './EditTemplateForm';
import { DuplicateTemplateForm } from '../DuplicateTemplateForm';
import { DeleteTemplateForm } from '../DeleteTemplateForm';
import type { Template } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface TemplateDetail extends Template {
  creator: { full_name: string } | null;
}

export default async function TemplateDetailPage({ params }: { params: { id: string } }) {
  const { user } = await requireSession();
  const isPartner = can(user.role).manageTemplates;
  const supabase = createClient();

  const { data: template } = await supabase
    .from('templates')
    .select(
      'id, name, description, file_name, storage_path, mime_type, size_bytes,' +
        ' placeholders, is_starter, created_by, created_at,' +
        ' creator:created_by (full_name)',
    )
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!template) notFound();

  const t = template as unknown as TemplateDetail;

  const { data: signed, error: signedError } = await supabase.storage
    .from('templates')
    .createSignedUrl(t.storage_path, 300);

  return (
    <>
      <PageHeader
        title={t.name}
        subtitle="Template details and placeholders."
        actions={
          <div className="flex flex-wrap gap-2">
            {signed?.signedUrl ? (
              <a
                href={signed.signedUrl}
                download={t.file_name}
                className="btn-secondary"
              >
                Download .docx
              </a>
            ) : null}
            {isPartner ? (
              <>
                <Link href={`/templates/${t.id}/setup`} className="btn-secondary">
                  Set up placeholders
                </Link>
                <DuplicateTemplateForm templateId={t.id} />
                <DeleteTemplateForm templateId={t.id} name={t.name} />
              </>
            ) : null}
          </div>
        }
      />

      {signedError || !signed?.signedUrl ? (
        <Alert tone="warning" title="Download not available">
          The template file could not be reached right now. Refresh the page to try again.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card space-y-4 p-4 sm:p-6 lg:col-span-2">
          <div>
            <h2 className="text-sm font-semibold text-ink-800">About this template</h2>
            <p className="mt-1 text-sm text-ink-600">
              {t.description || 'No description.'}
            </p>
          </div>

          <dl className="grid gap-3 border-t border-ink-200 pt-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">File name</dt>
              <dd className="mt-0.5 break-words text-ink-800">{t.file_name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Size</dt>
              <dd className="mt-0.5 text-ink-800">{formatBytes(t.size_bytes)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Uploaded</dt>
              <dd className="mt-0.5 text-ink-800">
                {formatDate(t.created_at)}
                {t.creator ? ` by ${t.creator.full_name}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Type</dt>
              <dd className="mt-0.5 text-ink-800">
                {t.is_starter ? <Badge tone="blue">Starter</Badge> : 'Firm template'}
              </dd>
            </div>
          </dl>
        </section>

        {isPartner ? (
          <section className="card p-4 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-ink-800">Edit details</h2>
            <EditTemplateForm
              templateId={t.id}
              initialName={t.name}
              initialDescription={t.description ?? ''}
            />
          </section>
        ) : null}
      </div>

      <section className="card mt-6 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-800">Placeholders</h2>
        {t.placeholders.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No placeholders yet"
              description={
                isPartner
                  ? 'Open the setup screen to turn bracketed text into tokens.'
                  : 'This template has not been set up with placeholders yet.'
              }
            />
          </div>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {t.placeholders.map((p) => (
              <li
                key={p.token}
                className="flex items-center justify-between rounded-md border border-ink-200 bg-ink-50 px-3 py-2"
              >
                <span className="font-medium text-ink-800">{p.label}</span>
                <code className="text-xs text-ink-500">{'{{' + p.token + '}}'}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadMatter } from '@/lib/matters';
import { PageHeader } from '@/components/ui/PageHeader';
import { GenerateDocumentForm } from './GenerateDocumentForm';
import { presetValues } from '@/lib/template-presets';
import type { Template } from '@/lib/types';

export const metadata = { title: 'Generate document · Wakili' };
export const dynamic = 'force-dynamic';

export default async function GenerateDocumentPage({ params }: { params: { id: string } }) {
  const { user } = await requireSession();
  const matter = await loadMatter(params.id);
  const supabase = createClient();

  const { data } = await supabase
    .from('templates')
    .select('id, name, description, file_name, storage_path, mime_type, size_bytes, placeholders')
    .is('deleted_at', null)
    .order('name');

  const templates = (data ?? []) as unknown as Template[];
  const defaultValues: Record<string, Record<string, string>> = {};
  for (const t of templates) {
    defaultValues[t.id] = presetValues(matter, user, t.placeholders);
  }

  return (
    <>
      <div className="mb-4">
        <Link href={`/matters/${matter.id}`} className="text-sm text-ink-600 hover:underline">
          ← Back to {matter.file_reference}
        </Link>
      </div>

      <PageHeader
        title="Generate document"
        subtitle={`Create a filled document for ${matter.title}.`}
      />

      <div className="max-w-3xl">
        <GenerateDocumentForm
          matterId={matter.id}
          templates={templates}
          defaultValues={defaultValues}
        />
      </div>
    </>
  );
}

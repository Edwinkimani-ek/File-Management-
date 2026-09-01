import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { TemplateSetupForm } from './TemplateSetupForm';
import { extractCandidates } from '@/lib/docx';
import type { Template } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TemplateSetupPage({ params }: { params: { id: string } }) {
  const { user } = await requireSession();
  if (!can(user.role).manageTemplates) notFound();

  const supabase = createClient();
  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!template) notFound();

  const { data: blob, error } = await supabase.storage
    .from('templates')
    .download(template.storage_path);
  if (error || !blob) {
    return (
      <>
        <PageHeader title="Set up template" subtitle="Could not load the file." />
        <Alert tone="error">The template file could not be read from storage.</Alert>
      </>
    );
  }

  const candidates = extractCandidates(await blob.arrayBuffer());
  const savedTokens = new Set(
    (template.placeholders as Template['placeholders']).map((p) => p.token),
  );

  return (
    <>
      <PageHeader
        title={template.name}
        subtitle="Highlight bracketed text or blanks and turn them into placeholders."
        actions={
          <Link href={`/templates/${template.id}`} className="btn-secondary">
            Done
          </Link>
        }
      />

      <div className="max-w-3xl">
        <TemplateSetupForm
          templateId={template.id}
          candidates={candidates}
          savedTokens={savedTokens}
        />
      </div>
    </>
  );
}

import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { isAiConfigured } from '@/lib/ai/provider';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { AssistantForm } from './AssistantForm';

export const metadata = { title: 'AI Assistant · Wakili' };
export const dynamic = 'force-dynamic';

interface MatterOption {
  id: string;
  file_reference: string;
  title: string;
  client_name: string | null;
}

interface DocumentOption {
  id: string;
  matter_id: string;
  file_name: string;
  mime_type: string | null;
}

export default async function AssistantPage() {
  const { user } = await requireSession();
  if (!can(user.role).useAi) {
    notFound();
  }

  const configured = isAiConfigured();
  const supabase = createClient();

  const { data: matters } = await supabase
    .from('matters')
    .select('id, file_reference, title, clients:client_id (full_name)')
    .is('deleted_at', null)
    .order('date_opened', { ascending: false })
    .limit(500);

  const { data: documents } = await supabase
    .from('documents')
    .select('id, matter_id, file_name, mime_type')
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false })
    .limit(1000);

  const matterOptions = (matters ?? []).map((m) => ({
    id: m.id,
    file_reference: m.file_reference,
    title: m.title,
    client_name: ((m.clients as unknown as { full_name: string } | null)?.full_name) ?? null,
  })) as MatterOption[];

  const documentOptions = (documents ?? []).map((d) => ({
    id: d.id,
    matter_id: d.matter_id,
    file_name: d.file_name,
    mime_type: d.mime_type,
  })) as DocumentOption[];

  return (
    <>
      <PageHeader
        title="AI Assistant"
        subtitle="Draft, summarise, and research with AI-generated guidance."
      />

      <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">AI-generated output — verify before relying on this.</p>
        <p>
          This tool provides research assistance, not legal advice. Every AI citation must be
          independently checked.
        </p>
      </div>

      {!configured ? (
        <Alert tone="warning" title="AI assistant not configured">
          Ask your administrator to set the <code>KIMI_API_KEY</code> environment variable.
        </Alert>
      ) : (
        <AssistantForm matters={matterOptions} documents={documentOptions} />
      )}
    </>
  );
}

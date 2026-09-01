import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/PageHeader';
import { TemplateUploadForm } from './TemplateUploadForm';

export const metadata = { title: 'Upload template · Wakili' };
export const dynamic = 'force-dynamic';

export default async function NewTemplatePage() {
  const { user } = await requireSession();
  if (!can(user.role).manageTemplates) notFound();

  return (
    <>
      <PageHeader
        title="Upload template"
        subtitle="Choose an existing .docx file. You will mark the placeholders next."
      />
      <div className="max-w-2xl">
        <TemplateUploadForm />
      </div>
    </>
  );
}

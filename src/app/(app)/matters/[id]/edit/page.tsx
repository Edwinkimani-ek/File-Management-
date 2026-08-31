import { notFound, redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { MatterForm } from '../../MatterForm';
import type { AppUser, Matter } from '@/lib/types';

export const metadata = { title: 'Edit matter · Wakili' };
export const dynamic = 'force-dynamic';

export default async function EditMatterPage({ params }: { params: { id: string } }) {
  const { user, firm } = await requireSession();
  if (!can(user.role).createMatters) redirect('/forbidden');

  const supabase = createClient();
  const { data: matter } = await supabase
    .from('matters')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!matter) notFound();

  if (matter.status === 'closed' && user.role !== 'partner') {
    return (
      <>
        <PageHeader title={matter.file_reference} />
        <Alert tone="warning" title="This matter is closed">
          A closed file is read-only. Ask a partner to reopen it if it needs to change.
        </Alert>
      </>
    );
  }

  const [{ data: clients }, { data: users }] = await Promise.all([
    supabase.from('clients').select('id, full_name').is('deleted_at', null).order('full_name'),
    supabase.from('users').select('*').eq('firm_id', firm.id).eq('status', 'active').order('full_name'),
  ]);

  return (
    <>
      <PageHeader title={`Edit ${matter.file_reference}`} subtitle={matter.title} />
      <div className="max-w-3xl">
        <MatterForm
          matter={matter as Matter}
          clients={clients ?? []}
          users={(users ?? []) as AppUser[]}
          firmName={firm.name}
          defaultLimitationYears={firm.default_limitation_years}
          currentUserId={user.id}
        />
      </div>
    </>
  );
}

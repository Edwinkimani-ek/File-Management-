import { notFound, redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClientForm } from '../../ClientForm';
import type { Client } from '@/lib/types';

export const metadata = { title: 'Edit client · Wakili' };
export const dynamic = 'force-dynamic';

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const { user } = await requireSession();
  if (!can(user.role).createClients) redirect('/forbidden');

  const supabase = createClient();
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) notFound();

  return (
    <>
      <PageHeader title={`Edit ${data.full_name}`} />
      <div className="max-w-2xl">
        <ClientForm client={data as Client} />
      </div>
    </>
  );
}

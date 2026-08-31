import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { MatterForm } from '../MatterForm';
import type { AppUser } from '@/lib/types';

export const metadata = { title: 'New matter · Wakili' };
export const dynamic = 'force-dynamic';

export default async function NewMatterPage({
  searchParams,
}: {
  searchParams: { client?: string };
}) {
  const { user, firm } = await requireSession();
  if (!can(user.role).createMatters) redirect('/forbidden');

  const supabase = createClient();
  const [{ data: clients }, { data: users }] = await Promise.all([
    supabase.from('clients').select('id, full_name').is('deleted_at', null).order('full_name'),
    supabase
      .from('users')
      .select('*')
      .eq('firm_id', firm.id)
      .eq('status', 'active')
      .order('full_name'),
  ]);

  return (
    <>
      <PageHeader title="Open a matter" subtitle="The digital equivalent of opening a brown file." />
      <div className="max-w-3xl">
        <MatterForm
          clients={clients ?? []}
          users={(users ?? []) as AppUser[]}
          firmName={firm.name}
          defaultLimitationYears={firm.default_limitation_years}
          defaultClientId={searchParams.client}
          currentUserId={user.id}
        />
      </div>
    </>
  );
}

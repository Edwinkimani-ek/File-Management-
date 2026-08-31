import { requireSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { can } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClientForm } from '../ClientForm';

export const metadata = { title: 'New client · Wakili' };
export const dynamic = 'force-dynamic';

export default async function NewClientPage() {
  const { user } = await requireSession();
  if (!can(user.role).createClients) redirect('/forbidden');

  return (
    <>
      <PageHeader
        title="New client"
        subtitle="The conflict check runs as you type the name."
      />
      <div className="max-w-2xl">
        <ClientForm />
      </div>
    </>
  );
}

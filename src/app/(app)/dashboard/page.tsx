import { requireSession } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata = { title: 'Dashboard · Wakili' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { user, firm } = await requireSession();
  return (
    <>
      <PageHeader title={`Good day, ${user.full_name.split(' ')[0]}`} subtitle={firm.name} />
      <div className="card p-6 text-sm text-ink-600">
        Your diary, matters and firm figures appear here.
      </div>
    </>
  );
}

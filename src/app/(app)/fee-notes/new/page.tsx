import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeeNoteForm } from '@/components/fees/FeeNoteForm';

export const metadata = { title: 'New fee note · Wakili' };
export const dynamic = 'force-dynamic';

export default async function NewFeeNotePage({
  searchParams,
}: {
  searchParams: { matter?: string };
}) {
  const { user, firm } = await requireSession();
  if (!can(user.role).seeMoney) notFound();

  const supabase = createClient();
  const { data: matters } = await supabase
    .from('matters')
    .select('id, file_reference, title')
    .is('deleted_at', null)
    .neq('status', 'closed')
    .order('file_reference');

  const matterChoices = matters ?? [];

  return (
    <>
      <PageHeader
        title="New fee note"
        subtitle="It is raised as a draft until a partner approves it."
      />
      <div className="max-w-2xl">
        {matterChoices.length === 0 ? (
          <EmptyState
            title="No open matters to bill"
            description="Fee notes can only be raised against open matters."
            action={
              can(user.role).createMatters ? (
                <Link href="/matters/new" className="btn-primary">
                  Open a matter
                </Link>
              ) : null
            }
          />
        ) : (
          <FeeNoteForm
            matters={matterChoices}
            fixedMatterId={searchParams.matter}
            vatRateBp={firm.vat_rate_bp}
          />
        )}
      </div>
    </>
  );
}

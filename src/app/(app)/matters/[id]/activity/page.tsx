import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadMatter } from '@/lib/matters';
import { EmptyState } from '@/components/ui/EmptyState';
import { ACTIVITY_LABELS } from '@/lib/activity';
import { formatDateTime } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function MatterActivityPage({ params }: { params: { id: string } }) {
  await requireSession();
  const matter = await loadMatter(params.id);
  const supabase = createClient();

  const { data } = await supabase
    .from('activity_log')
    .select('id, action, entity_type, detail, created_at, actor:user_id (full_name)')
    .eq('matter_id', matter.id)
    .order('created_at', { ascending: false })
    .limit(200);

  const entries = (data ?? []) as unknown as {
    id: string;
    action: string;
    entity_type: string;
    detail: string | null;
    created_at: string;
    actor: { full_name: string } | null;
  }[];

  return (
    <section className="card">
      <h2 className="border-b border-ink-200 px-4 py-3 text-sm font-semibold text-ink-800">
        Activity on this file
      </h2>
      {entries.length === 0 ? (
        <EmptyState title="Nothing recorded yet" />
      ) : (
        <ul className="divide-y divide-ink-200">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm text-ink-800">
                  <span className="font-medium">{entry.actor?.full_name ?? 'A user'}</span>{' '}
                  {(ACTIVITY_LABELS[entry.action] ?? entry.action).toLowerCase()}
                </p>
                {entry.detail ? (
                  <p className="truncate text-xs text-ink-500">{entry.detail}</p>
                ) : null}
              </div>
              <p className="whitespace-nowrap text-xs text-ink-500">
                {formatDateTime(entry.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

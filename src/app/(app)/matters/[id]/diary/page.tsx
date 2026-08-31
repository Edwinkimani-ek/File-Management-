import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { canWriteToMatter, loadMatter } from '@/lib/matters';
import { AgendaList, type AgendaEvent } from '@/components/diary/AgendaList';
import { AddEventPanel } from '@/components/diary/AddEventPanel';
import type { AppUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MatterDiaryPage({ params }: { params: { id: string } }) {
  const { user, firm } = await requireSession();
  const matter = await loadMatter(params.id);
  const supabase = createClient();

  const [{ data: events }, { data: users }] = await Promise.all([
    supabase
      .from('diary_events')
      .select(
        'id, title, event_type, event_date, event_time, court_station, status, outcome_notes,' +
          ' matter_id, matters:matter_id (id, file_reference, title),' +
          ' assignee:assigned_to (full_name)',
      )
      .eq('matter_id', matter.id)
      .order('event_date', { ascending: false }),
    supabase.from('users').select('*').eq('firm_id', firm.id).eq('status', 'active').order('full_name'),
  ]);

  const canAdd = can(user.role).createDiaryEvents && canWriteToMatter(matter, user.role);

  return (
    <div className="space-y-6">
      {canAdd ? (
        <AddEventPanel
          users={(users ?? []) as AppUser[]}
          fixedMatterId={matter.id}
          currentUserId={user.id}
          label="New entry on this file"
        />
      ) : null}

      <section className="card">
        <h2 className="border-b border-ink-200 px-4 py-3 text-sm font-semibold text-ink-800">
          Diary for this matter
        </h2>
        <AgendaList
          events={(events ?? []) as unknown as AgendaEvent[]}
          canComplete={canAdd}
          emptyTitle="Nothing diarised on this file yet"
        />
      </section>
    </div>
  );
}

import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { AgendaList, type AgendaEvent } from '@/components/diary/AgendaList';
import { MonthCalendar, type CalendarEvent } from '@/components/diary/MonthCalendar';
import { AddEventPanel } from '@/components/diary/AddEventPanel';
import { EVENT_TYPE_LABELS, entries } from '@/lib/labels';
import { addDaysToIsoDate, todayInNairobi } from '@/lib/dates';
import type { AppUser } from '@/lib/types';

export const metadata = { title: 'Court diary · Wakili' };
export const dynamic = 'force-dynamic';

const SELECT =
  'id, title, event_type, event_date, event_time, court_station, status, outcome_notes,' +
  ' matter_id, matters:matter_id (id, file_reference, title), assignee:assigned_to (full_name)';

function monthBounds(month: string): [string, string] {
  const [year, monthNumber] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`];
}

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: {
    view?: string; month?: string; assigned_to?: string; court_station?: string;
    event_type?: string; status?: string; overdue?: string;
  };
}) {
  const { user, firm } = await requireSession();
  const supabase = createClient();

  const today = todayInNairobi();
  const view = searchParams.view === 'month' ? 'month' : 'agenda';
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? '')
    ? searchParams.month!
    : today.slice(0, 7);

  const [{ data: users }, { data: matters }, { data: stations }] = await Promise.all([
    supabase.from('users').select('*').eq('firm_id', firm.id).eq('status', 'active').order('full_name'),
    supabase
      .from('matters')
      .select('id, file_reference, title')
      .is('deleted_at', null)
      .neq('status', 'closed')
      .order('file_reference'),
    supabase
      .from('diary_events')
      .select('court_station')
      .not('court_station', 'is', null)
      .limit(500),
  ]);

  const stationOptions = Array.from(
    new Set((stations ?? []).map((row) => row.court_station as string)),
  )
    .sort()
    .map((value) => ({ value, label: value }));

  let query = supabase.from('diary_events').select(SELECT);

  if (view === 'month') {
    const [from, to] = monthBounds(month);
    query = query.gte('event_date', from).lte('event_date', to);
  } else if (searchParams.overdue === '1') {
    query = query.lt('event_date', today).eq('status', 'upcoming');
  } else {
    // Agenda view is the "next 14 days" the spec asks for.
    query = query.gte('event_date', today).lte('event_date', addDaysToIsoDate(today, 14));
  }

  if (searchParams.assigned_to) query = query.eq('assigned_to', searchParams.assigned_to);
  if (searchParams.court_station) query = query.eq('court_station', searchParams.court_station);
  if (searchParams.event_type) query = query.eq('event_type', searchParams.event_type);
  if (searchParams.status) query = query.eq('status', searchParams.status);

  const { data } = await query
    .order('event_date')
    .order('event_time', { nullsFirst: true })
    .limit(500);

  const events = (data ?? []) as unknown as AgendaEvent[];

  const [prevMonth, nextMonth] = monthNeighbours(month);
  const linkParams = (overrides: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value);
    }
    return `/diary?${search.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Court diary"
        subtitle={
          view === 'month'
            ? 'Every listed date this month.'
            : searchParams.overdue === '1'
              ? 'Entries whose date has passed and that are still open.'
              : 'The next fourteen days.'
        }
        actions={
          can(user.role).createDiaryEvents ? (
            <AddEventPanel
              users={(users ?? []) as AppUser[]}
              matters={matters ?? []}
              currentUserId={user.id}
            />
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={linkParams({ view: 'agenda', overdue: undefined })}
              className={view === 'agenda' && searchParams.overdue !== '1' ? 'btn-primary' : 'btn-secondary'}>
          Next 14 days
        </Link>
        <Link href={linkParams({ view: 'month' })}
              className={view === 'month' ? 'btn-primary' : 'btn-secondary'}>
          Month
        </Link>
        <Link href={linkParams({ view: 'agenda', overdue: '1' })}
              className={searchParams.overdue === '1' ? 'btn-primary' : 'btn-secondary'}>
          Overdue
        </Link>

        {view === 'month' ? (
          <span className="ml-auto flex items-center gap-2">
            <Link href={linkParams({ month: prevMonth })} className="btn-secondary">←</Link>
            <span className="text-sm font-medium text-ink-700">{monthLabel(month)}</span>
            <Link href={linkParams({ month: nextMonth })} className="btn-secondary">→</Link>
          </span>
        ) : null}
      </div>

      <div className="card">
        <FilterBar
          searchPlaceholder="Not used here"
          selects={[
            {
              name: 'assigned_to',
              label: 'Advocate',
              options: (users ?? []).map((u) => ({ value: u.id, label: u.full_name })),
            },
            { name: 'court_station', label: 'Court station', options: stationOptions },
            {
              name: 'event_type',
              label: 'Type',
              options: entries(EVENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
            },
          ]}
        />

        {view === 'month' ? (
          <MonthCalendar month={month} events={events as unknown as CalendarEvent[]} />
        ) : (
          <AgendaList
            events={events}
            canComplete={can(user.role).createDiaryEvents}
            emptyTitle={
              searchParams.overdue === '1'
                ? 'Nothing overdue. The diary is clean.'
                : 'Nothing listed in the next fourteen days'
            }
          />
        )}
      </div>
    </>
  );
}

function monthNeighbours(month: string): [string, string] {
  const [year, monthNumber] = month.split('-').map(Number);
  const prev = new Date(Date.UTC(year, monthNumber - 2, 1));
  const next = new Date(Date.UTC(year, monthNumber, 1));
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return [fmt(prev), fmt(next)];
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

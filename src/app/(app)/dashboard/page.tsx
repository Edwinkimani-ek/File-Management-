import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { MatterStatusBadge } from '@/components/ui/StatusBadges';
import { EVENT_TYPE_LABELS, PRACTICE_AREA_LABELS } from '@/lib/labels';
import { addDaysToIsoDate, daysUntil, formatDate, formatTime, todayInNairobi } from '@/lib/dates';
import { formatKes } from '@/lib/money';

export const metadata = { title: 'Dashboard · Wakili' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { user, firm } = await requireSession();
  const supabase = createClient();
  const permissions = can(user.role);

  const today = todayInNairobi();
  const weekOut = addDaysToIsoDate(today, 7);

  // Every one of these queries is filtered by the matters policy, so an
  // associate's counts only ever cover their own files plus firm-wide
  // ones — the dashboard cannot leak a number the list views would hide.
  const [{ data: events }, { data: myMatters, count: myMatterCount }] = await Promise.all([
    supabase
      .from('diary_events')
      .select('id, title, event_type, event_date, event_time, court_station, matter_id,' +
              ' matters:matter_id (id, file_reference, title)')
      .eq('assigned_to', user.id)
      .eq('status', 'upcoming')
      .gte('event_date', today)
      .lte('event_date', weekOut)
      .order('event_date')
      .order('event_time', { nullsFirst: true })
      .limit(20),
    supabase
      .from('matters')
      .select('id, file_reference, title, practice_area, status, court_case_number', {
        count: 'exact',
      })
      .eq('assigned_to', user.id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('date_opened', { ascending: false })
      .limit(8),
  ]);

  let firmStats: { activeMatters: number; unpaidTotal: number; overdueEvents: number } | null = null;
  if (permissions.viewReports) {
    const [{ count: activeMatters }, { data: unpaid }, { count: overdueEvents }] = await Promise.all([
      supabase
        .from('matters')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('deleted_at', null),
      supabase
        .from('fee_notes')
        .select('total, amount_paid')
        .in('status', ['approved', 'sent', 'partially_paid']),
      supabase
        .from('diary_events')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'upcoming')
        .lt('event_date', today),
    ]);

    firmStats = {
      activeMatters: activeMatters ?? 0,
      unpaidTotal: (unpaid ?? []).reduce((sum, n) => sum + (n.total - n.amount_paid), 0),
      overdueEvents: overdueEvents ?? 0,
    };
  }

  const upcoming = (events ?? []) as unknown as {
    id: string;
    title: string;
    event_type: keyof typeof EVENT_TYPE_LABELS;
    event_date: string;
    event_time: string | null;
    court_station: string | null;
    matters: { id: string; file_reference: string; title: string } | null;
  }[];

  return (
    <>
      <PageHeader
        title={`Good day, ${user.full_name.split(' ')[0]}`}
        subtitle={`${firm.name} · ${formatDate(today)}`}
      />

      {firmStats ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Active matters" value={String(firmStats.activeMatters)} href="/matters?status=active" />
          <Stat label="Unpaid fee notes" value={formatKes(firmStats.unpaidTotal)} href="/reports" />
          <Stat
            label="Overdue diary entries"
            value={String(firmStats.overdueEvents)}
            href="/diary?overdue=1"
            tone={firmStats.overdueEvents > 0 ? 'warning' : 'plain'}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-800">Your next seven days</h2>
            <Link href="/diary" className="text-sm text-brand-700 hover:underline">Full diary</Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing in your diary this week" />
          ) : (
            <ul className="divide-y divide-ink-200">
              {upcoming.map((event) => {
                const days = daysUntil(event.event_date);
                return (
                  <li key={event.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-ink-900">{event.title}</p>
                      <Badge tone={days <= 1 ? 'red' : days <= 3 ? 'amber' : 'neutral'}>
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {EVENT_TYPE_LABELS[event.event_type]} · {formatDate(event.event_date)}
                      {event.event_time ? ` at ${formatTime(event.event_time)}` : ''}
                      {event.court_station ? ` · ${event.court_station}` : ''}
                    </p>
                    {event.matters ? (
                      <Link href={`/matters/${event.matters.id}`}
                            className="mt-1 block text-xs text-brand-700 hover:underline">
                        {event.matters.file_reference} — {event.matters.title}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-800">
              Your active matters{myMatterCount ? ` (${myMatterCount})` : ''}
            </h2>
            <Link href="/matters" className="text-sm text-brand-700 hover:underline">All matters</Link>
          </div>
          {!myMatters || myMatters.length === 0 ? (
            <EmptyState title="No matters assigned to you" />
          ) : (
            <ul className="divide-y divide-ink-200">
              {myMatters.map((matter) => (
                <li key={matter.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/matters/${matter.id}`}
                          className="font-medium text-brand-700 hover:underline">
                      {matter.file_reference}
                    </Link>
                    <MatterStatusBadge status={matter.status} />
                  </div>
                  <p className="text-sm text-ink-700">{matter.title}</p>
                  <p className="text-xs text-ink-500">
                    {PRACTICE_AREA_LABELS[matter.practice_area as keyof typeof PRACTICE_AREA_LABELS]}
                    {matter.court_case_number ? ` · ${matter.court_case_number}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  href,
  tone = 'plain',
}: {
  label: string;
  value: string;
  href: string;
  tone?: 'plain' | 'warning';
}) {
  return (
    <Link
      href={href}
      className={`card block p-4 transition hover:border-brand-300 ${
        tone === 'warning' ? 'border-amber-300 bg-amber-50' : ''
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink-900">{value}</p>
    </Link>
  );
}

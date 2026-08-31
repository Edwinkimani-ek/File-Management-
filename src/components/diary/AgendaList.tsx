'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState } from 'react-dom';
import { CalendarPlus, Check } from 'lucide-react';
import { completeDiaryEventAction } from '@/app/(app)/diary/actions';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { EventStatusBadge } from '@/components/ui/StatusBadges';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { EVENT_TYPE_LABELS, entries } from '@/lib/labels';
import { daysUntil, formatDate, formatTime } from '@/lib/dates';
import type { DiaryEventStatus, DiaryEventType } from '@/lib/types';

export interface AgendaEvent {
  id: string;
  title: string;
  event_type: DiaryEventType;
  event_date: string;
  event_time: string | null;
  court_station: string | null;
  status: DiaryEventStatus;
  outcome_notes: string | null;
  matter_id: string | null;
  matters: { id: string; file_reference: string; title: string } | null;
  assignee: { full_name: string } | null;
}

export function AgendaList({
  events,
  canComplete,
  emptyTitle = 'Nothing in the diary for this period',
}: {
  events: AgendaEvent[];
  canComplete: boolean;
  emptyTitle?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (events.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <ul className="divide-y divide-ink-200">
      {events.map((event) => {
        const days = daysUntil(event.event_date);
        const overdue = event.status === 'upcoming' && days < 0;

        return (
          <li key={event.id} className="px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink-900">{event.title}</p>
                  <Badge>{EVENT_TYPE_LABELS[event.event_type]}</Badge>
                  <EventStatusBadge status={event.status} />
                  {overdue ? <Badge tone="red">Overdue</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-ink-600">
                  {formatDate(event.event_date)}
                  {event.event_time ? ` at ${formatTime(event.event_time)}` : ''}
                  {event.court_station ? ` · ${event.court_station}` : ''}
                  {event.assignee ? ` · ${event.assignee.full_name}` : ''}
                </p>
                {event.matters ? (
                  <Link href={`/matters/${event.matters.id}`}
                        className="mt-1 block text-xs text-brand-700 hover:underline">
                    {event.matters.file_reference} — {event.matters.title}
                  </Link>
                ) : null}
                {event.outcome_notes ? (
                  <p className="mt-2 whitespace-pre-wrap rounded bg-ink-50 p-2 text-sm text-ink-700">
                    {event.outcome_notes}
                  </p>
                ) : null}
              </div>

              {canComplete && event.status === 'upcoming' ? (
                <button type="button" className="btn-secondary shrink-0"
                        onClick={() => setOpenId(openId === event.id ? null : event.id)}>
                  <Check className="h-4 w-4" /> Record outcome
                </button>
              ) : null}
            </div>

            {openId === event.id ? (
              <CompleteForm event={event} onDone={() => setOpenId(null)} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Marking a hearing done and diarising the next mention is one step. The
 * original entry keeps its date and gains an outcome, so the history of
 * what was listed survives the adjournment.
 */
function CompleteForm({ event, onDone }: { event: AgendaEvent; onDone: () => void }) {
  const [state, action] = useFormState(completeDiaryEventAction, EMPTY_FORM_STATE);
  const [adjourned, setAdjourned] = useState(false);
  const [addNext, setAddNext] = useState(false);
  const wantsNext = adjourned || addNext;

  return (
    <form action={action} className="mt-3 space-y-3 rounded-md border border-ink-200 bg-ink-50 p-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <input type="hidden" name="event_id" value={event.id} />

      <div>
        <label className="label" htmlFor={`outcome-${event.id}`}>What happened?</label>
        <textarea id={`outcome-${event.id}`} name="outcome_notes" className="input" rows={2} required
                  placeholder="Matter came up for hearing; plaintiff's first witness testified and was cross-examined." />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="adjourned" checked={adjourned}
                 onChange={(e) => {
                   setAdjourned(e.target.checked);
                   if (e.target.checked) setAddNext(true);
                 }} />
          Adjourned
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={wantsNext} disabled={adjourned}
                 onChange={(e) => setAddNext(e.target.checked)} />
          <CalendarPlus className="h-4 w-4" /> Diarise the next date
        </label>
      </div>

      {wantsNext ? (
        <div className="space-y-3 rounded border border-ink-200 bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`next-title-${event.id}`}>Next entry title</label>
              <input id={`next-title-${event.id}`} name="next_title" className="input"
                     defaultValue={event.title} />
            </div>
            <div>
              <label className="label" htmlFor={`next-type-${event.id}`}>Type</label>
              <select id={`next-type-${event.id}`} name="next_event_type" className="input"
                      defaultValue={event.event_type === 'hearing' ? 'mention' : event.event_type}>
                {entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor={`next-date-${event.id}`}>Date</label>
              <input id={`next-date-${event.id}`} name="next_event_date" type="date"
                     className="input" required />
            </div>
            <div>
              <label className="label" htmlFor={`next-time-${event.id}`}>Time</label>
              <input id={`next-time-${event.id}`} name="next_event_time" type="time" className="input" />
            </div>
            <div>
              <label className="label" htmlFor={`next-station-${event.id}`}>Court station</label>
              <input id={`next-station-${event.id}`} name="next_court_station" className="input"
                     defaultValue={event.court_station ?? ''} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…">Save outcome</SubmitButton>
        <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

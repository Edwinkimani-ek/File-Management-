'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { createDiaryEventAction, updateDiaryEventAction } from '@/app/(app)/diary/actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { EVENT_TYPE_LABELS, entries } from '@/lib/labels';
import type { AppUser, DiaryEvent } from '@/lib/types';

export interface MatterOption {
  id: string;
  file_reference: string;
  title: string;
}

export function DiaryEventForm({
  users,
  matters,
  fixedMatterId,
  event,
  currentUserId,
  onDone,
}: {
  users: AppUser[];
  matters?: MatterOption[];
  fixedMatterId?: string;
  event?: DiaryEvent;
  currentUserId: string;
  onDone?: () => void;
}) {
  const [state, action] = useFormState(
    event ? updateDiaryEventAction : createDiaryEventAction,
    EMPTY_FORM_STATE,
  );
  const [reminders, setReminders] = useState(
    (event?.reminder_days_before ?? [7, 3, 1]).join(', '),
  );

  return (
    <form action={action} className="space-y-4 p-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {event ? <input type="hidden" name="event_id" value={event.id} /> : null}
      {fixedMatterId ? <input type="hidden" name="matter_id" value={fixedMatterId} /> : null}

      {!fixedMatterId && matters ? (
        <div>
          <label className="label" htmlFor="diary_matter">Matter</label>
          <select id="diary_matter" name="matter_id" className="input"
                  defaultValue={event?.matter_id ?? ''}>
            <option value="">General entry — not tied to a matter</option>
            {matters.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.file_reference} — {matter.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="diary_title">Title</label>
        <input id="diary_title" name="title" className="input" required
               defaultValue={event?.title ?? ''} placeholder="Hearing — plaintiff's case" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="diary_type">Type</label>
          <select id="diary_type" name="event_type" className="input"
                  defaultValue={event?.event_type ?? 'hearing'}>
            {entries(EVENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="diary_assigned">Assigned to</label>
          <select id="diary_assigned" name="assigned_to" className="input"
                  defaultValue={event?.assigned_to ?? currentUserId}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="diary_date">Date</label>
          <input id="diary_date" name="event_date" type="date" className="input" required
                 defaultValue={event?.event_date ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="diary_time">Time</label>
          <input id="diary_time" name="event_time" type="time" className="input"
                 defaultValue={event?.event_time?.slice(0, 5) ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="diary_station">Court station</label>
          <input id="diary_station" name="court_station" className="input"
                 defaultValue={event?.court_station ?? ''} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="diary_reminders">Remind this many days before</label>
        <input id="diary_reminders" name="reminder_days_before" className="input"
               value={reminders} onChange={(e) => setReminders(e.target.value)}
               placeholder="7, 3, 1" />
        <p className="mt-1 text-xs text-ink-500">
          Comma separated. The assigned advocate is emailed on each of these days, plus a digest
          of the day&rsquo;s entries every morning at 7:00.
        </p>
      </div>

      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…">{event ? 'Save entry' : 'Add to diary'}</SubmitButton>
        {onDone ? (
          <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
        ) : null}
      </div>
    </form>
  );
}

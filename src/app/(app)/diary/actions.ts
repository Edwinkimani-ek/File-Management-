'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { logActivity } from '@/lib/activity';
import { friendlyDbError, optionalText, text, type FormState } from '@/lib/forms';
import type { DiaryEventType } from '@/lib/types';

const EVENT_TYPES: DiaryEventType[] = [
  'hearing', 'mention', 'filing_deadline', 'limitation_deadline',
  'client_meeting', 'other',
];

function readReminderDays(data: FormData): number[] {
  const raw = text(data, 'reminder_days_before');
  if (!raw) return [7, 3, 1];
  const days = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 365);
  return days.length > 0 ? Array.from(new Set(days)).sort((a, b) => b - a) : [7, 3, 1];
}

function readEventFields(data: FormData) {
  const type = text(data, 'event_type') as DiaryEventType;
  return {
    matter_id: optionalText(data, 'matter_id'),
    title: text(data, 'title'),
    event_type: EVENT_TYPES.includes(type) ? type : 'other',
    event_date: text(data, 'event_date'),
    event_time: optionalText(data, 'event_time'),
    court_station: optionalText(data, 'court_station'),
    assigned_to: optionalText(data, 'assigned_to'),
    reminder_days_before: readReminderDays(data),
  };
}

export async function createDiaryEventAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user, firm } = await requireSession();
  if (!can(user.role).createDiaryEvents) {
    return { error: 'Your role cannot add diary entries.' };
  }

  const fields = readEventFields(data);
  if (!fields.title) return { error: 'Give the entry a title.' };
  if (!fields.event_date) return { error: 'Choose a date.' };

  const supabase = createClient();
  const { data: created, error } = await supabase
    .from('diary_events')
    .insert({ ...fields, firm_id: firm.id, created_by: user.id })
    .select('id')
    .single();
  if (error || !created) return { error: friendlyDbError(error?.message ?? 'Could not save.') };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'diary.created',
    entityType: 'diary_event',
    entityId: created.id,
    matterId: fields.matter_id,
    detail: `${fields.title} on ${fields.event_date}`,
  });

  revalidatePath('/diary');
  if (fields.matter_id) revalidatePath(`/matters/${fields.matter_id}/diary`);
  return { success: 'Diary entry added.' };
}

export async function updateDiaryEventAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user, firm } = await requireSession();
  if (!can(user.role).createDiaryEvents) {
    return { error: 'Your role cannot change diary entries.' };
  }

  const id = text(data, 'event_id');
  if (!id) return { error: 'No entry selected.' };

  const fields = readEventFields(data);
  if (!fields.title) return { error: 'Give the entry a title.' };
  if (!fields.event_date) return { error: 'Choose a date.' };

  const supabase = createClient();
  const { error } = await supabase.from('diary_events').update(fields).eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'diary.updated',
    entityType: 'diary_event',
    entityId: id,
    matterId: fields.matter_id,
    detail: fields.title,
  });

  revalidatePath('/diary');
  if (fields.matter_id) revalidatePath(`/matters/${fields.matter_id}/diary`);
  return { success: 'Diary entry updated.' };
}

/**
 * Records the outcome of a hearing and, in the same step, diarises what
 * comes next. Marking a hearing done and setting the next mention date is
 * one action for the advocate, not two.
 */
export async function completeDiaryEventAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user, firm } = await requireSession();
  if (!can(user.role).createDiaryEvents) {
    return { error: 'Your role cannot change diary entries.' };
  }

  const id = text(data, 'event_id');
  const outcome = text(data, 'outcome_notes');
  const adjourned = data.get('adjourned') === 'on';
  const nextDate = optionalText(data, 'next_event_date');

  if (!id) return { error: 'No entry selected.' };
  if (!outcome) return { error: 'Record what happened before closing the entry.' };
  if (adjourned && !nextDate) {
    return { error: 'An adjourned matter needs the date it was adjourned to.' };
  }

  const supabase = createClient();
  const { data: original } = await supabase
    .from('diary_events')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!original) return { error: 'That entry no longer exists.' };

  let nextEventId: string | null = null;

  if (nextDate) {
    const type = text(data, 'next_event_type') as DiaryEventType;
    const { data: created, error: createError } = await supabase
      .from('diary_events')
      .insert({
        firm_id: firm.id,
        matter_id: original.matter_id,
        title: text(data, 'next_title') || original.title,
        event_type: EVENT_TYPES.includes(type) ? type : original.event_type,
        event_date: nextDate,
        event_time: optionalText(data, 'next_event_time'),
        court_station: optionalText(data, 'next_court_station') ?? original.court_station,
        assigned_to: original.assigned_to,
        reminder_days_before: original.reminder_days_before,
        rescheduled_from: original.id,
        created_by: user.id,
      })
      .select('id')
      .single();
    if (createError) return { error: friendlyDbError(createError.message) };
    nextEventId = created?.id ?? null;
  }

  // The original keeps its date and its outcome — the history of what was
  // listed and what happened stays intact — and points at its successor.
  const { error } = await supabase
    .from('diary_events')
    .update({
      status: adjourned ? 'adjourned' : 'done',
      outcome_notes: outcome,
      rescheduled_to: nextEventId,
    })
    .eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'diary.updated',
    entityType: 'diary_event',
    entityId: id,
    matterId: original.matter_id,
    detail: adjourned ? `Adjourned to ${nextDate}` : 'Marked done',
  });

  revalidatePath('/diary');
  if (original.matter_id) revalidatePath(`/matters/${original.matter_id}/diary`);
  return {
    success: adjourned
      ? `Adjourned. The next date is in the diary.`
      : nextEventId
        ? 'Recorded, and the next date is in the diary.'
        : 'Recorded.',
  };
}

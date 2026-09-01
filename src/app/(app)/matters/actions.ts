'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { logActivity } from '@/lib/activity';
import { addYearsToIsoDate } from '@/lib/dates';
import { friendlyDbError, optionalText, text, type FormState } from '@/lib/forms';
import type { MatterStatus, MatterVisibility, PracticeArea } from '@/lib/types';

const PRACTICE_AREAS: PracticeArea[] = [
  'civil_litigation', 'criminal', 'conveyancing', 'family',
  'employment', 'commercial', 'succession', 'other',
];

function readMatterFields(data: FormData) {
  const practiceArea = text(data, 'practice_area') as PracticeArea;
  const visibility = text(data, 'visibility') as MatterVisibility;

  return {
    file_reference: text(data, 'file_reference'),
    client_id: text(data, 'client_id'),
    title: text(data, 'title'),
    practice_area: PRACTICE_AREAS.includes(practiceArea) ? practiceArea : 'other',
    court_station: optionalText(data, 'court_station'),
    court_case_number: optionalText(data, 'court_case_number'),
    opposing_party: optionalText(data, 'opposing_party'),
    opposing_advocates: optionalText(data, 'opposing_advocates'),
    assigned_to: optionalText(data, 'assigned_to'),
    visibility: visibility === 'firm_wide' ? 'firm_wide' : 'assigned_only',
    description: optionalText(data, 'description'),
    cause_of_action_date: optionalText(data, 'cause_of_action_date'),
  };
}

export async function createMatterAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user, firm } = await requireSession();
  if (!can(user.role).createMatters) return { error: 'Your role cannot open matters.' };

  const fields = readMatterFields(data);
  if (!fields.file_reference) return { error: 'Enter a file reference.' };
  if (!fields.client_id) return { error: 'Choose the client.' };
  if (!fields.title) return { error: 'Enter a title for the matter.' };

  const supabase = createClient();
  const dateOpened = optionalText(data, 'date_opened');

  const { data: created, error } = await supabase
    .from('matters')
    .insert({
      ...fields,
      firm_id: firm.id,
      created_by: user.id,
      ...(dateOpened ? { date_opened: dateOpened } : {}),
    })
    .select('id, file_reference, title')
    .single();
  if (error || !created) return { error: friendlyDbError(error?.message ?? 'Could not save.') };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'matter.created',
    entityType: 'matter',
    entityId: created.id,
    matterId: created.id,
    detail: `${created.file_reference} — ${created.title}`,
  });

  // Limitation-deadline helper. The advocate ticked the box on the form
  // and the diary entry carries the disclaimer with it.
  const wantsLimitation = data.get('create_limitation_event') === 'on';
  if (wantsLimitation && fields.cause_of_action_date) {
    const years = Number(text(data, 'limitation_years')) || firm.default_limitation_years;
    const eventDate = addYearsToIsoDate(fields.cause_of_action_date, years);
    await supabase.from('diary_events').insert({
      firm_id: firm.id,
      matter_id: created.id,
      title: `Limitation deadline — ${created.title}`,
      event_type: 'limitation_deadline',
      event_date: eventDate,
      assigned_to: fields.assigned_to ?? user.id,
      created_by: user.id,
      outcome_notes:
        `Calculated as ${years} year(s) from a cause of action dated ` +
        `${fields.cause_of_action_date}. The advocate on the file must verify ` +
        `the applicable limitation period for this claim.`,
    });
  }

  revalidatePath('/matters');
  redirect(`/matters/${created.id}`);
}

export async function updateMatterAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user, firm } = await requireSession();
  const id = text(data, 'matter_id');
  if (!id) return { error: 'No matter selected.' };

  const fields = readMatterFields(data);
  if (!fields.file_reference) return { error: 'Enter a file reference.' };
  if (!fields.title) return { error: 'Enter a title for the matter.' };

  const status = text(data, 'status') as MatterStatus;
  const supabase = createClient();

  const { error } = await supabase
    .from('matters')
    .update({
      ...fields,
      ...(status === 'active' || status === 'dormant' ? { status } : {}),
    })
    .eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'matter.updated',
    entityType: 'matter',
    entityId: id,
    matterId: id,
  });

  revalidatePath(`/matters/${id}`);
  redirect(`/matters/${id}`);
}

export async function closeMatterAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user, firm } = await requireSession();
  const id = text(data, 'matter_id');
  const note = text(data, 'closing_note');

  if (!id) return { error: 'No matter selected.' };
  if (!note) return { error: 'A closing note is required to close a matter.' };

  const supabase = createClient();
  const { error } = await supabase
    .from('matters')
    .update({ status: 'closed', closing_note: note })
    .eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'matter.closed',
    entityType: 'matter',
    entityId: id,
    matterId: id,
    detail: note,
  });

  revalidatePath(`/matters/${id}`);
  return { success: 'Matter closed.' };
}

export async function reopenMatterAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user, firm } = await requireSession();
  if (!can(user.role).deleteRecords) return { error: 'Only a partner can reopen a matter.' };

  const id = text(data, 'matter_id');
  if (!id) return { error: 'No matter selected.' };

  const supabase = createClient();
  const { error } = await supabase.from('matters').update({ status: 'active' }).eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'matter.updated',
    entityType: 'matter',
    entityId: id,
    matterId: id,
    detail: 'Reopened',
  });

  revalidatePath(`/matters/${id}`);
  return { success: 'Matter reopened.' };
}

/** Soft delete. Partner only, enforced again by the matters_guard trigger. */
export async function deleteMatterAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  if (!can(user.role).deleteRecords) {
    return { error: 'Only a partner can delete matters.' };
  }

  const id = text(data, 'matter_id');
  if (!id) return { error: 'No matter selected.' };

  const supabase = createClient();
  const { error } = await supabase
    .from('matters')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath('/matters');
  redirect('/matters');
}

export async function suggestFileReferenceAction(prefix: string): Promise<string | null> {
  await requireSession();
  const supabase = createClient();
  const year = Number(new Date().toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', year: 'numeric' }));
  const { data } = await supabase.rpc('suggest_file_reference', {
    p_prefix: prefix,
    p_year: year,
  });
  return (data as string | null) ?? null;
}

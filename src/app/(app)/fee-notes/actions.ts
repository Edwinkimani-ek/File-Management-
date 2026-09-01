'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { logActivity } from '@/lib/activity';
import { formatKes, parseKesToCents } from '@/lib/money';
import { friendlyDbError, optionalText, text, type FormState } from '@/lib/forms';
import type { FeeNoteLineItem, PaymentMethod } from '@/lib/types';

const METHODS: PaymentMethod[] = ['mpesa', 'bank', 'cash', 'cheque'];

/**
 * Reads the repeating description/amount rows off the form. Amounts are
 * converted to whole cents here and recomputed by the database trigger,
 * so a tampered subtotal never survives.
 */
function readLineItems(data: FormData): { items: FeeNoteLineItem[]; error?: string } {
  const descriptions = data.getAll('item_description');
  const amounts = data.getAll('item_amount');
  const items: FeeNoteLineItem[] = [];

  for (let index = 0; index < descriptions.length; index += 1) {
    const description = String(descriptions[index] ?? '').trim();
    const rawAmount = String(amounts[index] ?? '').trim();
    if (!description && !rawAmount) continue;

    if (!description) return { items: [], error: `Line ${index + 1} needs a description.` };
    const cents = parseKesToCents(rawAmount);
    if (cents === null) return { items: [], error: `Line ${index + 1} needs an amount in KES.` };
    if (cents < 0) return { items: [], error: `Line ${index + 1} cannot be negative.` };

    items.push({ description, amount: cents });
  }

  if (items.length === 0) return { items: [], error: 'Add at least one line item.' };
  return { items };
}

export async function createFeeNoteAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user, firm } = await requireSession();
  if (!can(user.role).seeMoney) return { error: 'Your role cannot raise fee notes.' };

  const matterId = text(data, 'matter_id');
  if (!matterId) return { error: 'Choose the matter this fee note is on.' };

  const { items, error: itemsError } = readLineItems(data);
  if (itemsError) return { error: itemsError };

  const supabase = createClient();
  const { data: matter } = await supabase
    .from('matters')
    .select('id, client_id, status')
    .eq('id', matterId)
    .maybeSingle();
  if (!matter) return { error: 'That matter is not available to you.' };
  if (matter.status === 'closed') {
    return { error: 'You cannot raise a fee note against a closed matter.' };
  }

  const { data: created, error } = await supabase
    .from('fee_notes')
    .insert({
      firm_id: firm.id,
      matter_id: matter.id,
      client_id: matter.client_id,
      line_items: items,
      vat_applicable: data.get('vat_applicable') === 'on',
      notes: optionalText(data, 'notes'),
      created_by: user.id,
    })
    .select('id, fee_note_number')
    .single();
  if (error || !created) return { error: friendlyDbError(error?.message ?? 'Could not save.') };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'fee_note.created',
    entityType: 'fee_note',
    entityId: created.id,
    matterId: matter.id,
    detail: created.fee_note_number,
  });

  revalidatePath(`/matters/${matter.id}/fee-notes`);
  redirect(`/fee-notes/${created.id}`);
}

export async function updateFeeNoteAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user } = await requireSession();
  if (!can(user.role).seeMoney) return { error: 'Your role cannot edit fee notes.' };

  const id = text(data, 'fee_note_id');
  if (!id) return { error: 'No fee note selected.' };

  const { items, error: itemsError } = readLineItems(data);
  if (itemsError) return { error: itemsError };

  const supabase = createClient();
  const { error } = await supabase
    .from('fee_notes')
    .update({
      line_items: items,
      vat_applicable: data.get('vat_applicable') === 'on',
      notes: optionalText(data, 'notes'),
    })
    .eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath(`/fee-notes/${id}`);
  return { success: 'Fee note saved.' };
}

/**
 * Approve. Partner only — and the fee_notes_workflow trigger raises 42501
 * for anyone else, so calling this endpoint directly as an associate does
 * not work either.
 */
export async function approveFeeNoteAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user } = await requireSession();
  if (!can(user.role).approveFeeNotes) {
    return { error: 'Only a partner can approve a fee note.' };
  }

  const id = text(data, 'fee_note_id');
  if (!id) return { error: 'No fee note selected.' };

  const supabase = createClient();
  const { error } = await supabase.from('fee_notes').update({ status: 'approved' }).eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath(`/fee-notes/${id}`);
  return { success: 'Fee note approved.' };
}

export async function markFeeNoteSentAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user, firm } = await requireSession();
  if (!can(user.role).seeMoney) return { error: 'Your role cannot send fee notes.' };

  const id = text(data, 'fee_note_id');
  if (!id) return { error: 'No fee note selected.' };

  const supabase = createClient();
  const { error } = await supabase.from('fee_notes').update({ status: 'sent' }).eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'fee_note.sent',
    entityType: 'fee_note',
    entityId: id,
  });

  revalidatePath(`/fee-notes/${id}`);
  return { success: 'Marked as sent to the client.' };
}

export async function returnToDraftAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user } = await requireSession();
  if (!can(user.role).approveFeeNotes) {
    return { error: 'Only a partner can return a fee note to draft.' };
  }

  const id = text(data, 'fee_note_id');
  if (!id) return { error: 'No fee note selected.' };

  const supabase = createClient();
  const { error } = await supabase.from('fee_notes').update({ status: 'draft' }).eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath(`/fee-notes/${id}`);
  return { success: 'Returned to draft.' };
}

/**
 * Records a payment. The status of the fee note follows from the total of
 * its payments — the payments_apply trigger does that sum — so nothing
 * here sets "paid" by hand.
 */
export async function recordPaymentAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user, firm } = await requireSession();
  if (!can(user.role).recordPayments) {
    return { error: 'Only a partner can record payments.' };
  }

  const feeNoteId = text(data, 'fee_note_id');
  const amount = parseKesToCents(text(data, 'amount'));
  const method = text(data, 'method') as PaymentMethod;
  const paymentDate = optionalText(data, 'payment_date');

  if (!feeNoteId) return { error: 'No fee note selected.' };
  if (amount === null || amount <= 0) return { error: 'Enter the amount received.' };
  if (!METHODS.includes(method)) return { error: 'Choose how the money came in.' };

  const supabase = createClient();
  const { data: feeNote } = await supabase
    .from('fee_notes')
    .select('id, total, amount_paid')
    .eq('id', feeNoteId)
    .maybeSingle();
  if (!feeNote) return { error: 'That fee note is not available to you.' };

  const balance = feeNote.total - feeNote.amount_paid;
  if (amount > balance) {
    return { error: `The outstanding balance is ${formatKes(balance)}. You cannot record a payment larger than that.` };
  }

  const { error } = await supabase.from('payments').insert({
    firm_id: firm.id,
    fee_note_id: feeNoteId,
    amount,
    method,
    reference: optionalText(data, 'reference'),
    ...(paymentDate ? { payment_date: paymentDate } : {}),
  });
  if (error) return { error: friendlyDbError(error.message) };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'payment.recorded',
    entityType: 'payment',
    entityId: feeNoteId,
    detail: `${method} ${text(data, 'reference')}`.trim(),
  });

  revalidatePath(`/fee-notes/${feeNoteId}`);
  return { success: 'Payment recorded.' };
}

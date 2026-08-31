'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { logActivity } from '@/lib/activity';
import { friendlyDbError, optionalText, text, type FormState } from '@/lib/forms';
import type { ClientType } from '@/lib/types';

function readClientFields(data: FormData) {
  const type = text(data, 'type') as ClientType;
  return {
    type: type === 'company' ? 'company' : 'individual',
    full_name: text(data, 'full_name'),
    id_number: optionalText(data, 'id_number'),
    kra_pin: optionalText(data, 'kra_pin'),
    phone: optionalText(data, 'phone'),
    email: optionalText(data, 'email'),
    physical_address: optionalText(data, 'physical_address'),
    notes: optionalText(data, 'notes'),
  };
}

export async function createClientAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user, firm } = await requireSession();
  if (!can(user.role).createClients) {
    return { error: 'Your role cannot create clients.' };
  }

  const fields = readClientFields(data);
  if (!fields.full_name) return { error: 'Enter the client name.' };

  const supabase = createClient();
  const { data: created, error } = await supabase
    .from('clients')
    .insert({ ...fields, firm_id: firm.id, created_by: user.id })
    .select('id')
    .single();
  if (error || !created) return { error: friendlyDbError(error?.message ?? 'Could not save.') };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'client.created',
    entityType: 'client',
    entityId: created.id,
    detail: fields.full_name,
  });

  revalidatePath('/clients');
  redirect(`/clients/${created.id}`);
}

export async function updateClientAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user, firm } = await requireSession();
  if (!can(user.role).createClients) {
    return { error: 'Your role cannot edit clients.' };
  }

  const id = text(data, 'client_id');
  const fields = readClientFields(data);
  if (!id) return { error: 'No client selected.' };
  if (!fields.full_name) return { error: 'Enter the client name.' };

  const supabase = createClient();
  const { error } = await supabase.from('clients').update(fields).eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'client.updated',
    entityType: 'client',
    entityId: id,
    detail: fields.full_name,
  });

  revalidatePath(`/clients/${id}`);
  revalidatePath('/clients');
  redirect(`/clients/${id}`);
}

/**
 * Backs the live duplicate/conflict panel on the client and matter forms.
 * Duplicates are looked for on the identifiers a Kenyan firm actually has
 * to hand — national ID or company registration number, and phone.
 */
export async function checkClientAction(input: {
  name: string;
  idNumber?: string;
  phone?: string;
  excludeClientId?: string;
}): Promise<{
  duplicates: { id: string; full_name: string; reason: string }[];
  conflicts: {
    kind: string;
    label: string;
    matter_id: string | null;
    file_reference: string | null;
    matter_title: string | null;
  }[];
}> {
  const { firm } = await requireSession();
  const supabase = createClient();
  const name = input.name.trim();

  const duplicates: { id: string; full_name: string; reason: string }[] = [];

  const identifiers: [string, string | undefined, string][] = [
    ['id_number', input.idNumber?.trim(), 'the same ID / registration number'],
    ['phone', input.phone?.trim(), 'the same phone number'],
  ];

  for (const [column, value, reason] of identifiers) {
    if (!value) continue;
    let query = supabase
      .from('clients')
      .select('id, full_name')
      .eq('firm_id', firm.id)
      .eq(column, value)
      .limit(5);
    if (input.excludeClientId) query = query.neq('id', input.excludeClientId);
    const { data } = await query;
    for (const row of data ?? []) {
      if (!duplicates.some((d) => d.id === row.id)) {
        duplicates.push({ id: row.id, full_name: row.full_name, reason });
      }
    }
  }

  let conflicts: {
    kind: string;
    label: string;
    matter_id: string | null;
    file_reference: string | null;
    matter_title: string | null;
  }[] = [];

  if (name.length >= 3) {
    const { data } = await supabase.rpc('conflict_check', {
      p_query: name,
      p_exclude_client_id: input.excludeClientId ?? null,
    });
    conflicts = data ?? [];
  }

  return { duplicates, conflicts };
}

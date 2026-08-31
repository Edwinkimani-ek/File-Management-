'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { logActivity } from '@/lib/activity';
import { friendlyDbError, optionalText, text, type FormState } from '@/lib/forms';
import { safeFileName, validateDocumentFile } from '@/lib/uploads';
import type { DocumentCategory } from '@/lib/types';

const CATEGORIES: DocumentCategory[] = [
  'pleading', 'correspondence', 'court_order', 'attendance_note',
  'contract', 'evidence', 'other',
];

function readCategory(data: FormData, key = 'category'): DocumentCategory {
  const value = text(data, key) as DocumentCategory;
  return CATEGORIES.includes(value) ? value : 'other';
}

/**
 * Uploads one or more files to a matter. Each file is validated before it
 * is sent to storage; the bucket enforces the same size cap and MIME
 * allow-list, and the storage policies check the tenant and matter from
 * the object key, so nothing here is the only line of defence.
 */
export async function uploadDocumentsAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user, firm } = await requireSession();
  const supabase = createClient();

  const matterId = text(data, 'matter_id');
  if (!matterId) return { error: 'No matter selected.' };

  const category = readCategory(data);
  const notes = optionalText(data, 'notes');

  const files = data
    .getAll('files')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) return { error: 'Choose at least one file to upload.' };

  for (const file of files) {
    const problem = validateDocumentFile(file);
    if (problem) return { error: problem };
  }

  const uploaded: string[] = [];
  const failures: string[] = [];

  for (const file of files) {
    const key = `${firm.id}/${matterId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(key, file, { contentType: file.type, upsert: false });
    if (storageError) {
      failures.push(`${file.name}: ${storageError.message}`);
      continue;
    }

    const { data: row, error: rowError } = await supabase
      .from('documents')
      .insert({
        firm_id: firm.id,
        matter_id: matterId,
        file_name: file.name,
        storage_path: key,
        mime_type: file.type,
        size_bytes: file.size,
        category,
        uploaded_by: user.id,
        notes,
      })
      .select('id')
      .single();

    if (rowError || !row) {
      // Do not leave an orphan object behind if the row was refused.
      await supabase.storage.from('documents').remove([key]);
      failures.push(`${file.name}: ${friendlyDbError(rowError?.message ?? 'refused')}`);
      continue;
    }

    uploaded.push(file.name);
    await logActivity(supabase, {
      firmId: firm.id,
      userId: user.id,
      action: 'document.uploaded',
      entityType: 'document',
      entityId: row.id,
      matterId,
      detail: file.name,
    });
  }

  revalidatePath(`/matters/${matterId}`);

  if (failures.length > 0) {
    return {
      error: `${failures.join('; ')}${uploaded.length ? `. ${uploaded.length} file(s) did upload.` : ''}`,
    };
  }
  return { success: `Uploaded ${uploaded.length} file${uploaded.length === 1 ? '' : 's'}.` };
}

export async function updateDocumentAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user, firm } = await requireSession();
  const supabase = createClient();

  const id = text(data, 'document_id');
  const matterId = text(data, 'matter_id');
  const fileName = text(data, 'file_name');
  if (!id || !fileName) return { error: 'Give the document a name.' };

  const { error } = await supabase
    .from('documents')
    .update({
      file_name: fileName,
      category: readCategory(data),
      notes: optionalText(data, 'notes'),
    })
    .eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'document.updated',
    entityType: 'document',
    entityId: id,
    matterId,
    detail: fileName,
  });

  revalidatePath(`/matters/${matterId}`);
  return { success: 'Document updated.' };
}

/** Soft delete. Partner only, refused again by the documents_guard trigger. */
export async function deleteDocumentAction(data: FormData): Promise<void> {
  const { user, firm } = await requireSession();
  if (!can(user.role).deleteRecords) return;

  const supabase = createClient();
  const id = text(data, 'document_id');
  const matterId = text(data, 'matter_id');
  if (!id) return;

  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (!error) {
    await logActivity(supabase, {
      firmId: firm.id,
      userId: user.id,
      action: 'document.deleted',
      entityType: 'document',
      entityId: id,
      matterId,
      detail: text(data, 'file_name'),
    });
  }

  revalidatePath(`/matters/${matterId}`);
}

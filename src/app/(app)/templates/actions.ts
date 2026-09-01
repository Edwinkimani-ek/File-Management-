'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import {
  extractTokens,
  replacePlaceholders,
  type PlaceholderReplacement,
} from '@/lib/docx';
import { extensionOf, safeFileName } from '@/lib/uploads';
import { friendlyDbError, optionalText, text, type FormState } from '@/lib/forms';
import type { TemplatePlaceholder } from '@/lib/types';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_BYTES = 25 * 1024 * 1024;

function labelize(token: string): string {
  return token
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function uploadTemplateAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user, firm } = await requireSession();
  if (!can(user.role).manageTemplates) {
    return { error: 'Only partners can upload templates.' };
  }

  const name = text(data, 'name');
  const description = optionalText(data, 'description');
  const file = data.get('file');

  if (!name) return { error: 'Enter a template name.' };
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a .docx file.' };
  }
  const isDocx = file.type === DOCX_MIME || extensionOf(file.name) === 'docx';
  if (!isDocx) {
    return { error: 'Upload a Word document (.docx).' };
  }
  if (file.size > MAX_BYTES) {
    return { error: 'The file must be smaller than 25 MB.' };
  }

  const supabase = createClient();
  const path = `${firm.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('templates')
      .upload(path, file, { contentType: DOCX_MIME, upsert: false });
    if (uploadError) {
      console.error('Template storage upload failed:', uploadError);
      return { error: `Upload failed: ${friendlyDbError(uploadError.message)}` };
    }
  } catch (e) {
    console.error('Template storage upload threw:', e);
    return { error: `Upload failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const { data: created, error } = await supabase
    .from('templates')
    .insert({
      firm_id: firm.id,
      name,
      description,
      file_name: file.name,
      storage_path: path,
      mime_type: DOCX_MIME,
      size_bytes: file.size,
      placeholders: [],
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error('Template row insert failed:', error);
    await supabase.storage.from('templates').remove([path]);
    return { error: friendlyDbError(error?.message ?? 'Could not save template.') };
  }

  redirect(`/templates/${created.id}/setup`);
}

export async function convertPlaceholdersAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  if (!can(user.role).manageTemplates) {
    return { error: 'Only partners can set up templates.' };
  }

  const id = text(data, 'template_id');
  if (!id) return { error: 'No template selected.' };

  let replacements: PlaceholderReplacement[];
  try {
    replacements = JSON.parse(text(data, 'replacements'));
    if (!Array.isArray(replacements)) throw new Error('expected array');
  } catch {
    return { error: 'Invalid placeholder data.' };
  }

  const supabase = createClient();
  const { data: template } = await supabase
    .from('templates')
    .select('id, storage_path, file_name, placeholders')
    .eq('id', id)
    .maybeSingle();
  if (!template) return { error: 'Template not found.' };

  const { data: blob, error: dlError } = await supabase.storage
    .from('templates')
    .download(template.storage_path);
  if (dlError || !blob) return { error: 'Could not read the template file.' };

  const modified = replacePlaceholders(await blob.arrayBuffer(), replacements);

  const { error: upError } = await supabase.storage
    .from('templates')
    .upload(template.storage_path, modified, {
      contentType: DOCX_MIME,
      upsert: true,
    });
  if (upError) return { error: friendlyDbError(upError.message) };

  const existing = (template.placeholders as TemplatePlaceholder[]) ?? [];
  const added = replacements.map((r) => ({ token: r.token, label: labelize(r.token) }));
  const merged = new Map<string, TemplatePlaceholder>();
  for (const p of existing) merged.set(p.token, p);
  for (const p of added) merged.set(p.token, p);

  const { error } = await supabase
    .from('templates')
    .update({ placeholders: Array.from(merged.values()) })
    .eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath(`/templates/${id}/setup`);
  revalidatePath(`/templates/${id}`);
  return { success: 'Placeholders saved.' };
}

export async function saveTemplateAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  if (!can(user.role).manageTemplates) {
    return { error: 'Only partners can edit templates.' };
  }

  const id = text(data, 'template_id');
  const name = text(data, 'name');
  const description = optionalText(data, 'description');
  if (!id) return { error: 'No template selected.' };
  if (!name) return { error: 'Enter a template name.' };

  const supabase = createClient();
  const { error } = await supabase
    .from('templates')
    .update({ name, description })
    .eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath(`/templates/${id}`);
  revalidatePath('/templates');
  return { success: 'Template updated.' };
}

export async function duplicateTemplateAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user, firm } = await requireSession();
  if (!can(user.role).manageTemplates) {
    return { error: 'Only partners can duplicate templates.' };
  }

  const id = text(data, 'template_id');
  if (!id) return { error: 'No template selected.' };

  const supabase = createClient();
  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!template) return { error: 'Template not found.' };

  const { data: blob, error: dlError } = await supabase.storage
    .from('templates')
    .download(template.storage_path);
  if (dlError || !blob) return { error: 'Could not read the template file.' };

  const newPath = `${firm.id}/${crypto.randomUUID()}-${safeFileName(template.file_name)}`;
  const { error: upError } = await supabase.storage
    .from('templates')
    .upload(newPath, await blob.arrayBuffer(), {
      contentType: template.mime_type ?? DOCX_MIME,
      upsert: false,
    });
  if (upError) return { error: friendlyDbError(upError.message) };

  const { data: created, error } = await supabase
    .from('templates')
    .insert({
      firm_id: firm.id,
      name: `${template.name} (copy)`,
      description: template.description,
      file_name: template.file_name,
      storage_path: newPath,
      mime_type: template.mime_type,
      size_bytes: template.size_bytes,
      placeholders: template.placeholders,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !created) {
    await supabase.storage.from('templates').remove([newPath]);
    return { error: friendlyDbError(error?.message ?? 'Could not duplicate template.') };
  }

  redirect(`/templates/${created.id}/setup`);
}

export async function deleteTemplateAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  if (!can(user.role).manageTemplates) {
    return { error: 'Only partners can delete templates.' };
  }

  const id = text(data, 'template_id');
  if (!id) return { error: 'No template selected.' };

  const supabase = createClient();
  const { error } = await supabase
    .from('templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath('/templates');
  return { success: 'Template deleted.' };
}

/**
 * Refreshes the stored placeholder metadata from the actual file.
 * Useful after a manual re-upload or when the setup screen gets out of sync.
 */
export async function refreshPlaceholdersAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  if (!can(user.role).manageTemplates) {
    return { error: 'Only partners can refresh templates.' };
  }

  const id = text(data, 'template_id');
  if (!id) return { error: 'No template selected.' };

  const supabase = createClient();
  const { data: template } = await supabase
    .from('templates')
    .select('id, storage_path')
    .eq('id', id)
    .maybeSingle();
  if (!template) return { error: 'Template not found.' };

  const { data: blob, error: dlError } = await supabase.storage
    .from('templates')
    .download(template.storage_path);
  if (dlError || !blob) return { error: 'Could not read the template file.' };

  const tokens = extractTokens(await blob.arrayBuffer());
  const placeholders = tokens.map((token) => ({ token, label: labelize(token) }));

  const { error } = await supabase
    .from('templates')
    .update({ placeholders })
    .eq('id', id);
  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath(`/templates/${id}/setup`);
  revalidatePath(`/templates/${id}`);
  return { success: 'Placeholder list refreshed from the file.' };
}

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { loadMatter, canWriteToMatter } from '@/lib/matters';
import { renderTemplate } from '@/lib/docx';
import { safeFileName } from '@/lib/uploads';
import { friendlyDbError, text, type FormState } from '@/lib/forms';
import type { Template } from '@/lib/types';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function generateDocumentAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user, firm } = await requireSession();
  const matterId = text(data, 'matter_id');
  const templateId = text(data, 'template_id');
  const outputName = text(data, 'output_name');
  let values: Record<string, string>;

  if (!matterId) return { error: 'Matter is required.' };
  if (!templateId) return { error: 'Choose a template.' };

  try {
    values = JSON.parse(text(data, 'values'));
    if (typeof values !== 'object' || values === null) throw new Error('expected object');
  } catch {
    return { error: 'Invalid placeholder values.' };
  }

  const matter = await loadMatter(matterId);
  if (!canWriteToMatter(matter, user.role)) {
    return { error: 'This matter is read-only.' };
  }

  const supabase = createClient();
  const { data: template } = await supabase
    .from('templates')
    .select('id, name, file_name, storage_path, placeholders')
    .eq('id', templateId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!template) return { error: 'Template not found.' };

  const { data: blob, error: dlError } = await supabase.storage
    .from('templates')
    .download(template.storage_path);
  if (dlError || !blob) return { error: 'Could not read the template file.' };

  const rendered = renderTemplate(await blob.arrayBuffer(), values);
  const fileName = outputName || `${template.name} - ${matter.file_reference}.docx`;
  const safeName = safeFileName(fileName);
  const path = `${firm.id}/${matter.id}/${crypto.randomUUID()}-${safeName}`;

  const { error: upError } = await supabase.storage
    .from('documents')
    .upload(path, rendered, { contentType: DOCX_MIME, upsert: false });
  if (upError) return { error: friendlyDbError(upError.message) };

  const { error: insertError } = await supabase.from('documents').insert({
    firm_id: firm.id,
    matter_id: matter.id,
    file_name: safeName,
    storage_path: path,
    mime_type: DOCX_MIME,
    size_bytes: rendered.byteLength,
    category: 'correspondence',
    uploaded_by: user.id,
    notes: `Generated from “${template.name}”.`,
  });

  if (insertError) {
    await supabase.storage.from('documents').remove([path]);
    return { error: friendlyDbError(insertError.message) };
  }

  revalidatePath(`/matters/${matter.id}`);
  redirect(`/matters/${matter.id}`);
}

export function presetValues(
  matter: Awaited<ReturnType<typeof loadMatter>>,
  user: { full_name: string },
  placeholders: Template['placeholders'],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of placeholders) {
    switch (p.token) {
      case 'client_name':
        map[p.token] = matter.clients?.full_name ?? '';
        break;
      case 'matter_title':
        map[p.token] = matter.title;
        break;
      case 'file_reference':
        map[p.token] = matter.file_reference;
        break;
      case 'today_date':
      case 'date':
        map[p.token] = today();
        break;
      case 'advocate_name':
        map[p.token] = user.full_name;
        break;
      case 'kes_amount':
        map[p.token] = '';
        break;
      default:
        map[p.token] = '';
    }
  }
  return map;
}

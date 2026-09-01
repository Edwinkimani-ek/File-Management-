'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { loadMatter, canWriteToMatter } from '@/lib/matters';
import { renderTemplate, extractText } from '@/lib/docx';
import { getAiProvider } from '@/lib/ai/provider';
import { logActivity } from '@/lib/activity';
import { safeFileName } from '@/lib/uploads';
import { friendlyDbError, text, type FormState } from '@/lib/forms';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function assertCanUseAi(role: string) {
  if (role !== 'partner' && role !== 'associate') {
    throw new Error('Only partners and associates can use AI features.');
  }
}

function bufferFromNodeBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function textToDocxBuffer(content: string): Promise<ArrayBuffer> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: content
        .split('\n')
        .map((line) => new Paragraph({ children: [new TextRun({ text: line })] })),
    }],
  });
  return bufferFromNodeBuffer(await Packer.toBuffer(doc));
}

export async function generateDocumentAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user, firm } = await requireSession();
  const matterId = text(data, 'matter_id');
  const templateId = text(data, 'template_id');
  const outputName = text(data, 'output_name');
  const polishedContent = text(data, 'polished_content');
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

  let rendered: ArrayBuffer;
  let notes: string;

  if (polishedContent) {
    rendered = await textToDocxBuffer(polishedContent);
    notes = `AI-polished from “${template.name}”.`;
  } else {
    const { data: blob, error: dlError } = await supabase.storage
      .from('templates')
      .download(template.storage_path);
    if (dlError || !blob) return { error: 'Could not read the template file.' };
    rendered = renderTemplate(await blob.arrayBuffer(), values);
    notes = `Generated from “${template.name}”.`;
  }

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
    notes,
  });

  if (insertError) {
    await supabase.storage.from('documents').remove([path]);
    return { error: friendlyDbError(insertError.message) };
  }

  revalidatePath(`/matters/${matter.id}`);
  redirect(`/matters/${matter.id}`);
}

export async function polishDocumentAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user, firm } = await requireSession();
  assertCanUseAi(user.role);

  const provider = getAiProvider();
  if (!provider) return { error: 'AI assistant is not configured. Set KIMI_API_KEY.' };

  const matterId = text(data, 'matter_id');
  const templateId = text(data, 'template_id');
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
    .select('id, name, storage_path')
    .eq('id', templateId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!template) return { error: 'Template not found.' };

  const { data: blob, error: dlError } = await supabase.storage
    .from('templates')
    .download(template.storage_path);
  if (dlError || !blob) return { error: 'Could not read the template file.' };

  const rendered = renderTemplate(await blob.arrayBuffer(), values);
  const renderedText = extractText(rendered) ?? '';
  if (!renderedText.trim()) {
    return { error: 'The rendered template has no readable text to polish.' };
  }

  const system =
    'You are a Kenyan legal drafting assistant. Polish the document below for tone, clarity, ' +
    'and completeness. Do not change facts, names, amounts, dates, or file references unless ' +
    'they are clearly inconsistent. Preserve Kenyan legal English. ' +
    'When you mention a case or statute, add "[verify this citation]". ' +
    'Output only the polished document text.';

  let polished: string;
  try {
    const { text } = await provider.generateText({
      system,
      messages: [{ role: 'user', content: renderedText }],
      temperature: 0.4,
    });
    polished = text;
  } catch (e) {
    console.error('Polish document failed:', e);
    return { error: `AI polish failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'ai.assistant',
    entityType: 'ai_template_polish',
    entityId: template.id,
    matterId: matter.id,
    detail: `Polished template "${template.name}" for ${matter.file_reference}.`,
  });

  return { success: polished };
}

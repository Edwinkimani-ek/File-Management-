'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getAiProvider } from '@/lib/ai/provider';
import { buildDocumentContext, buildMatterContext } from '@/lib/ai/context';
import { extractText } from '@/lib/docx';
import { logActivity } from '@/lib/activity';
import { safeFileName } from '@/lib/uploads';
import { friendlyDbError, optionalText, text, bool, type FormState } from '@/lib/forms';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const DISCLAIMER =
  'AI-generated — verify before relying on this. This is research assistance, not legal advice.';

const CITATION_INSTRUCTION =
  'When you mention a case, statute, or regulation, add "[verify this citation]" beside it. ' +
  'Do not invent citations.';

function systemForMode(mode: string): string {
  const base = `You are a Kenyan legal research assistant for a law firm. ${DISCLAIMER} ${CITATION_INSTRUCTION}`;
  switch (mode) {
    case 'draft':
      return (
        base +
        '\n\nDrafting mode: produce a first draft of a legal document requested by the user. ' +
        'Use Kenyan legal English and formatting. Keep facts consistent with the matter context. ' +
        'Do not add facts that are not in the context unless the user supplies them. ' +
        'Output only the document text, ready to be saved as a Word document.'
      );
    case 'summarise':
      return (
        base +
        '\n\nSummarisation mode: summarise the matter context and any attached document in clear, ' +
        'concise paragraphs. Highlight deadlines, risks, financial status, and next steps. ' +
        'Do not include speculative accusations.'
      );
    case 'research':
      return (
        base +
        '\n\nResearch mode: answer Kenyan legal questions. Explain the general legal position, ' +
        'cite relevant statutes or cases with "[verify this citation]", and note when the answer ' +
        'depends on specific facts. If a matter context is provided, tailor the answer to it.'
      );
    default:
      return base;
  }
}

function assertCanUseAi(role: string) {
  if (role !== 'partner' && role !== 'associate') {
    throw new Error('Only partners and associates can use the AI assistant.');
  }
}

export async function generateAssistantResponseAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { user, firm } = await requireSession();
  assertCanUseAi(user.role);

  const provider = getAiProvider();
  if (!provider) return { error: 'AI assistant is not configured. Set KIMI_API_KEY.' };

  const mode = text(data, 'mode');
  const matterId = optionalText(data, 'matter_id');
  const documentId = optionalText(data, 'document_id');
  const attachDocument = bool(data, 'attach_document');
  const prompt = text(data, 'prompt');

  if (!['draft', 'summarise', 'research'].includes(mode)) {
    return { error: 'Choose a mode.' };
  }
  if (!prompt) return { error: 'Enter a prompt.' };
  if (mode === 'summarise' && !matterId) {
    return { error: 'Summaries need a matter to summarise.' };
  }

  const supabase = createClient();
  const contextParts: string[] = [];

  if (matterId) {
    try {
      contextParts.push(await buildMatterContext(matterId));
    } catch {
      return { error: 'Could not load the selected matter.' };
    }
  }

  if (documentId) {
    const docContext = await buildDocumentContext(documentId);
    if (docContext) contextParts.push(docContext);

    if (attachDocument) {
      const { data: doc } = await supabase
        .from('documents')
        .select('storage_path, file_name, mime_type')
        .eq('id', documentId)
        .is('deleted_at', null)
        .maybeSingle();
      if (doc?.mime_type === DOCX_MIME) {
        const { data: blob, error } = await supabase.storage.from('documents').download(doc.storage_path);
        if (!error && blob) {
          const extracted = extractText(await blob.arrayBuffer());
          if (extracted) {
            contextParts.push(`\n### Full text of ${doc.file_name}\n${extracted.slice(0, 25000)}`);
          }
        }
      } else if (doc) {
        contextParts.push(
          `\n(The selected document ${doc.file_name} is not a .docx, so its full text could not be attached.)`,
        );
      }
    }
  }

  const userMessage =
    contextParts.length > 0
      ? `Context:\n${contextParts.join('\n\n')}\n\nRequest:\n${prompt}`
      : prompt;

  let result: string;
  try {
    const { text } = await provider.generateText({
      system: systemForMode(mode),
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.4,
    });
    result = text;
  } catch (e) {
    console.error('AI assistant call failed:', e);
    return { error: `AI call failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  await logActivity(supabase, {
    firmId: firm.id,
    userId: user.id,
    action: 'ai.assistant',
    entityType: 'ai_call',
    entityId: null,
    matterId: matterId ?? null,
    detail: JSON.stringify({ mode, prompt: prompt.slice(0, 500), document_id: documentId ?? null }),
  });

  return { success: result };
}

export async function saveDraftAction(_prev: FormState, data: FormData): Promise<FormState> {
  const { user, firm } = await requireSession();
  assertCanUseAi(user.role);

  const matterId = text(data, 'matter_id');
  const title = text(data, 'title');
  const content = text(data, 'content');

  if (!matterId) return { error: 'Choose a matter.' };
  if (!title) return { error: 'Enter a document title.' };
  if (!content) return { error: 'No draft content to save.' };

  const supabase = createClient();
  const { data: matter } = await supabase
    .from('matters')
    .select('id, firm_id, status')
    .eq('id', matterId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!matter) return { error: 'Matter not found.' };
  if (matter.status === 'closed' && user.role !== 'partner') {
    return { error: 'This matter is closed. A partner can add documents.' };
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: content
        .split('\n')
        .map((line) => new Paragraph({ children: [new TextRun({ text: line })] })),
    }],
  });
  const buffer = await Packer.toBuffer(doc);
  const fileName = `${safeFileName(title)}.docx`;
  const path = `${firm.id}/${matterId}/${crypto.randomUUID()}-${fileName}`;

  const { error: upError } = await supabase.storage
    .from('documents')
    .upload(path, buffer, { contentType: DOCX_MIME, upsert: false });
  if (upError) return { error: friendlyDbError(upError.message) };

  const { error: insertError } = await supabase.from('documents').insert({
    firm_id: firm.id,
    matter_id: matterId,
    file_name: fileName,
    storage_path: path,
    mime_type: DOCX_MIME,
    size_bytes: buffer.byteLength,
    category: 'correspondence',
    uploaded_by: user.id,
    notes: 'AI-generated draft.',
  });

  if (insertError) {
    await supabase.storage.from('documents').remove([path]);
    return { error: friendlyDbError(insertError.message) };
  }

  revalidatePath(`/matters/${matterId}`);
  return { success: `Saved as ${fileName}.` };
}

'use client';

import { useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import { generateAssistantResponseAction, saveDraftAction } from './actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';

type Mode = 'draft' | 'summarise' | 'research';

interface MatterOption {
  id: string;
  file_reference: string;
  title: string;
  client_name: string | null;
}

interface DocumentOption {
  id: string;
  matter_id: string;
  file_name: string;
  mime_type: string | null;
}

const MODE_LABELS: Record<Mode, string> = {
  draft: 'Draft a document',
  summarise: 'Summarise a matter',
  research: 'Legal research / ask a question',
};

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  draft: 'Describe the document you need. If you select a matter, context will be included.',
  summarise: 'Select a matter to summarise its status, diary, fees, documents and activity.',
  research: 'Ask a Kenyan legal question. Select a matter to make it matter-specific.',
};

export function AssistantForm({
  matters,
  documents,
}: {
  matters: MatterOption[];
  documents: DocumentOption[];
}) {
  const [mode, setMode] = useState<Mode>('draft');
  const [matterId, setMatterId] = useState<string>('');
  const [documentId, setDocumentId] = useState<string>('');
  const [attachDocument, setAttachDocument] = useState(false);

  const [generateState, generateAction] = useFormState(
    generateAssistantResponseAction,
    EMPTY_FORM_STATE,
  );
  const [saveState, saveAction] = useFormState(saveDraftAction, EMPTY_FORM_STATE);

  const matterDocuments = useMemo(
    () => documents.filter((d) => d.matter_id === matterId && d.mime_type?.includes('wordprocessingml')),
    [documents, matterId],
  );

  const selectedMatter = matters.find((m) => m.id === matterId);
  const generatedText = generateState.success ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="card space-y-5 p-4 sm:p-6 lg:col-span-1">
        <form action={generateAction} className="space-y-5">
          {generateState.error ? <Alert tone="error">{generateState.error}</Alert> : null}

          <div>
            <label className="label" htmlFor="mode">Mode</label>
            <select
              id="mode"
              name="mode"
              className="input"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as Mode);
              }}
            >
              {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-500">{MODE_DESCRIPTIONS[mode]}</p>
          </div>

          <div>
            <label className="label" htmlFor="matter_id">Matter</label>
            <select
              id="matter_id"
              name="matter_id"
              className="input"
              value={matterId}
              onChange={(e) => {
                setMatterId(e.target.value);
                setDocumentId('');
                setAttachDocument(false);
              }}
            >
              <option value="">{mode === 'summarise' ? 'Select a matter' : 'No matter selected'}</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.file_reference} — {m.title}
                  {m.client_name ? ` (${m.client_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {mode === 'summarise' && matterDocuments.length > 0 ? (
            <div>
              <label className="label" htmlFor="document_id">Attach a document</label>
              <select
                id="document_id"
                name="document_id"
                className="input"
                value={documentId}
                onChange={(e) => {
                  setDocumentId(e.target.value);
                  setAttachDocument(false);
                }}
              >
                <option value="">None (metadata only)</option>
                {matterDocuments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.file_name}
                  </option>
                ))}
              </select>
              {documentId ? (
                <label className="mt-2 flex items-start gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    name="attach_document"
                    checked={attachDocument}
                    onChange={(e) => setAttachDocument(e.target.checked)}
                  />
                  <span>
                    Include the full document text. Only .docx files are supported. The text will be
                    sent to the AI API.
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="prompt">
              {mode === 'draft' ? 'What should the document do?' : 'Your request or question'}
            </label>
            <textarea
              id="prompt"
              name="prompt"
              className="input"
              rows={5}
              placeholder={
                mode === 'draft'
                  ? 'e.g. A demand letter for unpaid fees, polite but firm, 14-day deadline'
                  : mode === 'summarise'
                    ? 'e.g. Summarise this matter for the client update meeting'
                    : 'e.g. What is the limitation period for a personal injury claim in Kenya?'
              }
              required
            />
          </div>

          <SubmitButton pendingText="Thinking…">Generate</SubmitButton>
        </form>
      </section>

      <section className="card flex flex-col p-4 sm:p-6 lg:col-span-2">
        <h2 className="text-sm font-semibold text-ink-800">AI output</h2>

        {generatedText ? (
          <>
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              AI-generated — verify before relying on this. Independently check every citation.
            </div>
            <div className="min-h-[12rem] flex-1 whitespace-pre-wrap rounded-md border border-ink-200 bg-ink-50 p-3 text-sm text-ink-800">
              {generatedText}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-ink-300 bg-ink-50 p-6 text-sm text-ink-500">
            Generated text will appear here.
          </div>
        )}

        {mode === 'draft' && generatedText && matterId ? (
          <form action={saveAction} className="mt-4 space-y-3">
            {saveState.error ? <Alert tone="error">{saveState.error}</Alert> : null}
            {saveState.success ? <Alert tone="success">{saveState.success}</Alert> : null}
            <input type="hidden" name="matter_id" value={matterId} />
            <input type="hidden" name="content" value={generatedText} />
            <div className="flex gap-2">
              <input
                name="title"
                className="input flex-1"
                placeholder="Document title"
                defaultValue={`AI draft — ${selectedMatter?.file_reference ?? 'document'}`}
                required
              />
              <SubmitButton pendingText="Saving…">Save to matter</SubmitButton>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}

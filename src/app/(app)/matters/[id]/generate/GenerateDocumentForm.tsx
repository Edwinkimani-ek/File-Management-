'use client';

import { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { generateDocumentAction, polishDocumentAction } from './actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import type { Template } from '@/lib/types';

export function GenerateDocumentForm({
  matterId,
  templates,
  defaultValues,
}: {
  matterId: string;
  templates: Template[];
  defaultValues: Record<string, Record<string, string>>;
}) {
  const [generateState, generateAction] = useFormState(generateDocumentAction, EMPTY_FORM_STATE);
  const [polishState, polishAction] = useFormState(polishDocumentAction, EMPTY_FORM_STATE);
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? '');
  const [values, setValues] = useState<Record<string, string>>(() =>
    selectedId ? { ...defaultValues[selectedId] } : {},
  );
  const [polishedContent, setPolishedContent] = useState<string | null>(null);

  useEffect(() => {
    if (polishState.success) setPolishedContent(polishState.success);
  }, [polishState.success]);

  const selected = templates.find((t) => t.id === selectedId);

  const chooseTemplate = (id: string) => {
    setSelectedId(id);
    setValues(id ? { ...defaultValues[id] } : {});
    setPolishedContent(null);
  };

  if (templates.length === 0) {
    return (
      <div className="card p-4 sm:p-6">
        <p className="text-sm text-ink-600">
          No templates are available. Ask a partner to upload a template first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={generateAction} className="card space-y-6 p-4 sm:p-6">
        {generateState.error ? <Alert tone="error">{generateState.error}</Alert> : null}
        {polishState.error ? <Alert tone="error">{polishState.error}</Alert> : null}

        <input type="hidden" name="matter_id" value={matterId} />
        <input type="hidden" name="template_id" value={selectedId} />
        <input type="hidden" name="values" value={JSON.stringify(values)} />
        <input type="hidden" name="polished_content" value={polishedContent ?? ''} />

        <div>
          <label className="label" htmlFor="template_id">Template</label>
          <select
            id="template_id"
            name="template_id"
            className="input"
            value={selectedId}
            onChange={(e) => chooseTemplate(e.target.value)}
            required
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {selected?.description ? (
            <p className="mt-1 text-xs text-ink-500">{selected.description}</p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="output_name">Output file name</label>
          <input
            id="output_name"
            name="output_name"
            className="input"
            defaultValue={selected ? `${selected.name} - ${matterId.slice(0, 8)}.docx` : ''}
            placeholder="e.g. Demand letter - KM/CIV/045/2026.docx"
          />
          <p className="mt-1 text-xs text-ink-500">.docx will be added automatically if omitted.</p>
        </div>

        {selected && selected.placeholders.length > 0 ? (
          <section>
            <h2 className="text-sm font-semibold text-ink-800">Placeholders</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {selected.placeholders.map((p) => (
                <div key={p.token}>
                  <label className="label" htmlFor={p.token}>
                    {p.label}
                  </label>
                  <input
                    id={p.token}
                    className="input"
                    value={values[p.token] ?? ''}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [p.token]: e.target.value }))
                    }
                    placeholder={p.token}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : selected ? (
          <p className="text-sm text-ink-500">This template has no placeholders.</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingText={polishedContent ? 'Saving…' : 'Generating…'}>
            {polishedContent ? 'Save polished document' : 'Generate document'}
          </SubmitButton>
          <button
            type="submit"
            formAction={polishAction}
            className="btn-secondary"
            disabled={!selected}
          >
            Improve with AI
          </button>
          {polishedContent ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPolishedContent(null)}
            >
              Reject polish
            </button>
          ) : null}
        </div>
      </form>

      {polishedContent ? (
        <section className="card space-y-3 p-4 sm:p-6">
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            AI-polished draft — verify before relying on this. Independently check every citation.
          </div>
          <h3 className="text-sm font-semibold text-ink-800">Polished draft</h3>
          <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-ink-200 bg-ink-50 p-3 text-sm text-ink-800">
            {polishedContent}
          </div>
        </section>
      ) : null}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { convertPlaceholdersAction } from '../../actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Badge } from '@/components/ui/Badge';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import type { PlaceholderCandidate, PlaceholderReplacement } from '@/lib/docx';

export function TemplateSetupForm({
  templateId,
  candidates,
  savedTokens,
}: {
  templateId: string;
  candidates: PlaceholderCandidate[];
  savedTokens: Set<string>;
}) {
  const [state, action] = useFormState(convertPlaceholdersAction, EMPTY_FORM_STATE);
  const [tokens, setTokens] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const c of candidates) {
      if (c.suggestedToken) map[c.id] = c.suggestedToken;
    }
    return map;
  });
  const [pending, setPending] = useState<PlaceholderReplacement[]>([]);

  const bracketed = candidates.filter((c) => c.type === 'bracketed');
  const blanks = candidates.filter((c) => c.type === 'blank');

  const convert = (candidate: PlaceholderCandidate) => {
    const token = tokens[candidate.id]?.trim();
    if (!token) return;
    if (savedTokens.has(token) || pending.some((p) => p.token === token)) {
      // Still allow; metadata will be deduped.
    }
    if (candidate.type === 'bracketed' && candidate.original) {
      setPending((prev) => [...prev, { token, original: candidate.original }]);
    } else if (candidate.type === 'blank') {
      const index = Number(candidate.id.replace('blank-', ''));
      setPending((prev) => [...prev, { token, index }]);
    }
  };

  const removePending = (index: number) => {
    setPending((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form action={action} className="card space-y-6 p-4 sm:p-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <input type="hidden" name="template_id" value={templateId} />
      <input type="hidden" name="replacements" value={JSON.stringify(pending)} />

      <section>
        <h2 className="text-sm font-semibold text-ink-800">Bracketed placeholders</h2>
        {bracketed.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">
            No bracketed text like <code>[CLIENT_NAME]</code> was found.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {bracketed.map((candidate) => {
              const converted = pending.some(
                (p) => p.original === candidate.original && p.token === tokens[candidate.id],
              );
              return (
                <li
                  key={candidate.id}
                  className="flex flex-col gap-2 rounded-md border border-ink-200 bg-ink-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">{candidate.original}</p>
                    <p className="text-xs text-ink-500">{candidate.context}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="input w-40"
                      value={tokens[candidate.id] ?? ''}
                      onChange={(e) =>
                        setTokens((prev) => ({ ...prev, [candidate.id]: e.target.value }))
                      }
                      placeholder="token_name"
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={converted || !tokens[candidate.id]?.trim()}
                      onClick={() => convert(candidate)}
                    >
                      {converted ? 'Added' : 'Convert'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink-800">Blank spaces</h2>
        {blanks.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No empty text runs were found.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {blanks.slice(0, 50).map((candidate) => {
              const converted = pending.some(
                (p) => p.index === Number(candidate.id.replace('blank-', '')) &&
                  p.token === tokens[candidate.id],
              );
              return (
                <li
                  key={candidate.id}
                  className="flex flex-col gap-2 rounded-md border border-ink-200 bg-ink-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Badge>blank</Badge>
                    <p className="mt-1 text-xs text-ink-500">{candidate.context}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="input w-40"
                      value={tokens[candidate.id] ?? ''}
                      onChange={(e) =>
                        setTokens((prev) => ({ ...prev, [candidate.id]: e.target.value }))
                      }
                      placeholder="token_name"
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={converted || !tokens[candidate.id]?.trim()}
                      onClick={() => convert(candidate)}
                    >
                      {converted ? 'Added' : 'Convert'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pending.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-ink-800">Ready to save</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {pending.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded border border-ink-200 px-3 py-2">
                <span className="font-mono text-ink-700">
                  {p.original ? `${p.original} → {{${p.token}}}` : `blank → {{${p.token}}}`}
                </span>
                <button type="button" className="text-xs text-red-700 hover:underline" onClick={() => removePending(i)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…" disabled={pending.length === 0}>
          Save placeholders
        </SubmitButton>
      </div>
    </form>
  );
}

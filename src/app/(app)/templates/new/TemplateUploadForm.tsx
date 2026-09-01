'use client';

import { useFormState } from 'react-dom';
import { uploadTemplateAction } from '../actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function TemplateUploadForm() {
  const [state, action] = useFormState(uploadTemplateAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="card space-y-4 p-4 sm:p-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div>
        <label className="label" htmlFor="name">Template name</label>
        <input id="name" name="name" className="input" placeholder="e.g. Demand letter" required />
      </div>

      <div>
        <label className="label" htmlFor="description">Description (optional)</label>
        <textarea
          id="description"
          name="description"
          className="input"
          rows={2}
          placeholder="When this template should be used"
        />
      </div>

      <div>
        <label className="label" htmlFor="file">Word document</label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="input"
          required
        />
        <p className="mt-1 text-xs text-ink-500">.doc or .docx, up to 25 MB.</p>
      </div>

      <SubmitButton pendingText="Uploading…">Upload and continue</SubmitButton>
    </form>
  );
}

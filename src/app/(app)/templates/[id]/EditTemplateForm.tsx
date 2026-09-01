'use client';

import { useFormState } from 'react-dom';
import { saveTemplateAction } from '../actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function EditTemplateForm({
  templateId,
  initialName,
  initialDescription,
}: {
  templateId: string;
  initialName: string;
  initialDescription: string;
}) {
  const [state, action] = useFormState(saveTemplateAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <input type="hidden" name="template_id" value={templateId} />

      <div>
        <label className="label" htmlFor="name">Template name</label>
        <input
          id="name"
          name="name"
          className="input"
          defaultValue={initialName}
          placeholder="e.g. Demand letter"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="description">Description (optional)</label>
        <textarea
          id="description"
          name="description"
          className="input"
          rows={3}
          defaultValue={initialDescription}
          placeholder="When this template should be used"
        />
      </div>

      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}

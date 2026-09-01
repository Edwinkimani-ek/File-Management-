'use client';

import { useFormState } from 'react-dom';
import { duplicateTemplateAction } from './actions';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function DuplicateTemplateForm({ templateId }: { templateId: string }) {
  const [state, action] = useFormState(duplicateTemplateAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="template_id" value={templateId} />
      <SubmitButton className="btn-secondary" pendingText="Duplicating…">
        Duplicate
      </SubmitButton>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
    </form>
  );
}

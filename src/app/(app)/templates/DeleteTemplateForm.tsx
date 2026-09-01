'use client';

import { deleteTemplateAction } from './actions';
import { ConfirmDelete } from '@/components/ui/ConfirmDelete';

export function DeleteTemplateForm({ templateId, name }: { templateId: string; name: string }) {
  return (
    <ConfirmDelete
      action={async (data) => {
        await deleteTemplateAction({}, data);
      }}
      hidden={{ template_id: templateId }}
      label="Delete"
      confirmLabel="Delete template"
      question={`Remove “${name}” from the firm’s templates?`}
    />
  );
}

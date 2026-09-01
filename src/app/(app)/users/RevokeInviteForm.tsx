'use client';

import { useFormState } from 'react-dom';
import { revokeInviteAction } from './actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function RevokeInviteForm({ invitationId }: { invitationId: string }) {
  const [state, action] = useFormState(revokeInviteAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="invitation_id" value={invitationId} />
      <SubmitButton className="btn-danger text-xs px-2 py-1" pendingText="Withdrawing…">
        Withdraw
      </SubmitButton>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
    </form>
  );
}

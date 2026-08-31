'use client';

import { useFormState } from 'react-dom';
import { acceptInviteAction } from '../../actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action] = useFormState(acceptInviteAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">Choose a password</label>
        <input id="password" name="password" type="password" className="input" required
               minLength={8} autoComplete="new-password" />
        <p className="mt-1 text-xs text-ink-500">At least 8 characters.</p>
      </div>
      <div>
        <label className="label" htmlFor="confirm_password">Confirm password</label>
        <input id="confirm_password" name="confirm_password" type="password" className="input"
               required minLength={8} autoComplete="new-password" />
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Setting up…">
        Set password and join
      </SubmitButton>
    </form>
  );
}

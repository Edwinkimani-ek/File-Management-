'use client';

import { useFormState } from 'react-dom';
import { resetPasswordAction } from '../actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function ResetPasswordForm() {
  const [state, action] = useFormState(resetPasswordAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" className="input" required
               minLength={8} autoComplete="new-password" />
      </div>
      <div>
        <label className="label" htmlFor="confirm_password">Confirm new password</label>
        <input id="confirm_password" name="confirm_password" type="password" className="input"
               required minLength={8} autoComplete="new-password" />
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Saving…">
        Save password
      </SubmitButton>
    </form>
  );
}

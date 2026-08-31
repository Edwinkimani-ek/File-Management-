'use client';

import { useFormState } from 'react-dom';
import { forgotPasswordAction } from '../actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function ForgotPasswordForm() {
  const [state, action] = useFormState(forgotPasswordAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" />
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

'use client';

import { useFormState } from 'react-dom';
import { signUpAction } from '../actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function SignUpForm() {
  const [state, action] = useFormState(signUpAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <div>
        <label className="label" htmlFor="firm_name">Firm name</label>
        <input id="firm_name" name="firm_name" className="input" required
               placeholder="Kimani &amp; Company Advocates" />
      </div>
      <div>
        <label className="label" htmlFor="full_name">Your full name</label>
        <input id="full_name" name="full_name" className="input" required autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">Your email</label>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" required
               minLength={8} autoComplete="new-password" />
        <p className="mt-1 text-xs text-ink-500">At least 8 characters.</p>
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Creating your firm…">
        Create firm
      </SubmitButton>
    </form>
  );
}

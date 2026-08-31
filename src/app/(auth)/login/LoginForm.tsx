'use client';

import { useFormState } from 'react-dom';
import { signInAction } from '../actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [state, action] = useFormState(signInAction, EMPTY_FORM_STATE);
  const error = state.error ?? initialError;

  return (
    <form action={action} className="mt-6 space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <input type="hidden" name="next" value={next ?? ''} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
        />
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

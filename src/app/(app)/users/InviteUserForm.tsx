'use client';

import { useFormState } from 'react-dom';
import { inviteUserAction } from './actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { ROLE_LABELS, entries } from '@/lib/labels';

export function InviteUserForm() {
  const [state, action] = useFormState(inviteUserAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="mt-4 space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success">
          <span className="break-all">{state.success}</span>
        </Alert>
      ) : null}
      <div>
        <label className="label" htmlFor="invite_full_name">Full name</label>
        <input id="invite_full_name" name="full_name" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="invite_email">Email</label>
        <input id="invite_email" name="email" type="email" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="invite_role">Role</label>
        <select id="invite_role" name="role" className="input" defaultValue="associate">
          {entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Sending…">
        Send invitation
      </SubmitButton>
    </form>
  );
}

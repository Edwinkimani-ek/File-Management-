'use client';

import { useFormState } from 'react-dom';
import { updateUserAction } from './actions';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Badge } from '@/components/ui/Badge';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { ROLE_LABELS, entries } from '@/lib/labels';
import type { AppUser } from '@/lib/types';

export function UserRow({ user, isSelf }: { user: AppUser; isSelf: boolean }) {
  const [state, action] = useFormState(updateUserAction, EMPTY_FORM_STATE);

  return (
    <tr>
      <td className="td">
        <p className="font-medium text-ink-900">
          {user.full_name}
          {isSelf ? <span className="ml-2 text-xs text-ink-500">(you)</span> : null}
        </p>
        <p className="text-xs text-ink-500">{user.email}</p>
        {/* Needed for the pre-pilot security checks, which ask you to paste
            real ids into URLs and API calls. */}
        <p className="mt-1 select-all font-mono text-[11px] text-ink-400">{user.id}</p>
        {state.error ? <p className="mt-1 text-xs text-red-700">{state.error}</p> : null}
        {state.success ? <p className="mt-1 text-xs text-brand-700">{state.success}</p> : null}
      </td>
      <td className="td" colSpan={3}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="user_id" value={user.id} />
          <select name="role" className="input w-36" defaultValue={user.role}>
            {entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="status" className="input w-32" defaultValue={user.status} disabled={isSelf}>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          {isSelf ? <input type="hidden" name="status" value={user.status} /> : null}
          <SubmitButton className="btn-secondary" pendingText="Saving…">Save</SubmitButton>
          {user.status === 'disabled' ? <Badge tone="red">Disabled</Badge> : null}
        </form>
      </td>
    </tr>
  );
}

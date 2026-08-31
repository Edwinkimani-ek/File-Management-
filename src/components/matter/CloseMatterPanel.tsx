'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { closeMatterAction, reopenMatterAction } from '@/app/(app)/matters/actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';

export function CloseMatterPanel({ matterId }: { matterId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(closeMatterAction, EMPTY_FORM_STATE);

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        Close matter
      </button>
    );
  }

  return (
    <form action={action} className="card w-full space-y-3 p-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <input type="hidden" name="matter_id" value={matterId} />
      <div>
        <label className="label" htmlFor="closing_note">Closing note</label>
        <textarea id="closing_note" name="closing_note" className="input" rows={3} required
                  placeholder="Judgment delivered 12/03/2026; decree extracted and served; file to archive." />
        <p className="mt-1 text-xs text-ink-500">
          Once closed, the file is read-only for everyone except a partner.
        </p>
      </div>
      <div className="flex gap-2">
        <SubmitButton pendingText="Closing…">Close this matter</SubmitButton>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ReopenMatterButton({ matterId }: { matterId: string }) {
  const [state, action] = useFormState(reopenMatterAction, EMPTY_FORM_STATE);
  return (
    <form action={action}>
      <input type="hidden" name="matter_id" value={matterId} />
      <SubmitButton className="btn-secondary" pendingText="Reopening…">Reopen matter</SubmitButton>
      {state.error ? <p className="mt-1 text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}

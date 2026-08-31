'use client';

import { useFormState } from 'react-dom';
import {
  approveFeeNoteAction, markFeeNoteSentAction, recordPaymentAction, returnToDraftAction,
} from '@/app/(app)/fee-notes/actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { PAYMENT_METHOD_LABELS, entries } from '@/lib/labels';
import { todayInNairobi } from '@/lib/dates';
import type { FeeNoteStatus } from '@/lib/types';

/**
 * Draft → Approved → Sent → Paid. The Approve control is only rendered
 * for a partner, and the fee_notes_workflow trigger refuses the same
 * transition for anyone else, so hiding the button is a courtesy rather
 * than the control.
 */
export function FeeNoteWorkflow({
  feeNoteId,
  status,
  isPartner,
}: {
  feeNoteId: string;
  status: FeeNoteStatus;
  isPartner: boolean;
}) {
  const [approveState, approve] = useFormState(approveFeeNoteAction, EMPTY_FORM_STATE);
  const [sentState, markSent] = useFormState(markFeeNoteSentAction, EMPTY_FORM_STATE);
  const [draftState, returnToDraft] = useFormState(returnToDraftAction, EMPTY_FORM_STATE);

  const error = approveState.error ?? sentState.error ?? draftState.error;

  return (
    <div className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {status === 'draft' && isPartner ? (
          <form action={approve}>
            <input type="hidden" name="fee_note_id" value={feeNoteId} />
            <SubmitButton pendingText="Approving…">Approve</SubmitButton>
          </form>
        ) : null}

        {status === 'approved' ? (
          <form action={markSent}>
            <input type="hidden" name="fee_note_id" value={feeNoteId} />
            <SubmitButton pendingText="Saving…">Mark as sent</SubmitButton>
          </form>
        ) : null}

        {status === 'approved' && isPartner ? (
          <form action={returnToDraft}>
            <input type="hidden" name="fee_note_id" value={feeNoteId} />
            <SubmitButton className="btn-secondary" pendingText="Saving…">
              Return to draft
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {status === 'draft' && !isPartner ? (
        <p className="text-sm text-ink-600">
          This fee note is a draft. A partner has to approve it before it goes to the client.
        </p>
      ) : null}
    </div>
  );
}

export function RecordPaymentForm({
  feeNoteId,
  balance,
}: {
  feeNoteId: string;
  balance: number;
}) {
  const [state, action] = useFormState(recordPaymentAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="space-y-3 p-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <input type="hidden" name="fee_note_id" value={feeNoteId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pay_amount">Amount received (KES)</label>
          <input id="pay_amount" name="amount" inputMode="decimal" className="input" required
                 defaultValue={balance > 0 ? (balance / 100).toFixed(2) : ''} />
        </div>
        <div>
          <label className="label" htmlFor="pay_method">Method</label>
          <select id="pay_method" name="method" className="input" defaultValue="mpesa">
            {entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pay_reference">Reference</label>
          <input id="pay_reference" name="reference" className="input"
                 placeholder="M-Pesa code, bank reference or cheque number" />
        </div>
        <div>
          <label className="label" htmlFor="pay_date">Date received</label>
          <input id="pay_date" name="payment_date" type="date" className="input"
                 defaultValue={todayInNairobi()} />
        </div>
      </div>

      <SubmitButton pendingText="Recording…">Record payment</SubmitButton>
      <p className="text-xs text-ink-500">
        The status of the fee note follows from the payments recorded against it. Payments summing
        to the total mark it paid on their own.
      </p>
    </form>
  );
}

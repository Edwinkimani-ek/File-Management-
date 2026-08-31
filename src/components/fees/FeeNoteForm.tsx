'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import { createFeeNoteAction, updateFeeNoteAction } from '@/app/(app)/fee-notes/actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { formatKes, parseKesToCents } from '@/lib/money';
import type { FeeNote } from '@/lib/types';

interface Row {
  description: string;
  amount: string;
}

export interface MatterChoice {
  id: string;
  file_reference: string;
  title: string;
}

export function FeeNoteForm({
  matters,
  fixedMatterId,
  feeNote,
  vatRateBp,
}: {
  matters?: MatterChoice[];
  fixedMatterId?: string;
  feeNote?: FeeNote;
  vatRateBp: number;
}) {
  const [state, action] = useFormState(
    feeNote ? updateFeeNoteAction : createFeeNoteAction,
    EMPTY_FORM_STATE,
  );

  const [rows, setRows] = useState<Row[]>(
    feeNote && feeNote.line_items.length > 0
      ? feeNote.line_items.map((item) => ({
          description: item.description,
          amount: (item.amount / 100).toFixed(2),
        }))
      : [{ description: '', amount: '' }],
  );
  const [vat, setVat] = useState(feeNote?.vat_applicable ?? false);

  const subtotal = rows.reduce((sum, row) => sum + (parseKesToCents(row.amount) ?? 0), 0);
  const vatAmount = vat ? Math.round((subtotal * vatRateBp) / 10000) : 0;

  const setRow = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <form action={action} className="card space-y-5 p-4 sm:p-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {feeNote ? <input type="hidden" name="fee_note_id" value={feeNote.id} /> : null}
      {fixedMatterId ? <input type="hidden" name="matter_id" value={fixedMatterId} /> : null}

      {!fixedMatterId && !feeNote && matters ? (
        <div>
          <label className="label" htmlFor="fn_matter">Matter</label>
          <select id="fn_matter" name="matter_id" className="input" required defaultValue="">
            <option value="" disabled>Choose a matter…</option>
            {matters.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.file_reference} — {matter.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <p className="label">Particulars</p>
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row">
              <input
                name="item_description"
                className="input sm:flex-1"
                placeholder="Instructions to defend suit; perusal; drawing and filing defence"
                value={row.description}
                onChange={(e) => setRow(index, { description: e.target.value })}
              />
              <div className="flex gap-2">
                <input
                  name="item_amount"
                  inputMode="decimal"
                  className="input sm:w-40"
                  placeholder="150,000"
                  value={row.amount}
                  onChange={(e) => setRow(index, { amount: e.target.value })}
                />
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  onClick={() => setRows((c) => (c.length === 1 ? c : c.filter((_, i) => i !== index)))}
                  aria-label={`Remove line ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-secondary mt-3"
          onClick={() => setRows((c) => [...c, { description: '', amount: '' }])}
        >
          <Plus className="h-4 w-4" /> Add a line
        </button>
        <p className="mt-2 text-xs text-ink-500">Amounts in KES. Enter 150000 or 150,000.</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="vat_applicable" checked={vat}
               onChange={(e) => setVat(e.target.checked)} />
        Charge VAT at {(vatRateBp / 100).toFixed(vatRateBp % 100 === 0 ? 0 : 2)}%
      </label>

      <div className="rounded-md border border-ink-200 bg-ink-50 p-3 text-sm">
        <Row label="Subtotal" value={formatKes(subtotal)} />
        {vat ? <Row label="VAT" value={formatKes(vatAmount)} /> : null}
        <Row label="Total" value={formatKes(subtotal + vatAmount)} emphasised />
      </div>

      <div>
        <label className="label" htmlFor="fn_notes">Note on the fee note</label>
        <textarea id="fn_notes" name="notes" className="input" rows={2}
                  defaultValue={feeNote?.notes ?? ''}
                  placeholder="Payable within 30 days. M-Pesa paybill 000000, account KM/CIV/045." />
      </div>

      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…">
          {feeNote ? 'Save fee note' : 'Create fee note'}
        </SubmitButton>
        {feeNote ? (
          <Link href={`/fee-notes/${feeNote.id}`} className="btn-secondary">Cancel</Link>
        ) : null}
      </div>
    </form>
  );
}

function Row({
  label,
  value,
  emphasised,
}: {
  label: string;
  value: string;
  emphasised?: boolean;
}) {
  return (
    <div className={`flex justify-between ${emphasised ? 'mt-1 border-t border-ink-200 pt-1 font-semibold' : ''}`}>
      <span className="text-ink-600">{label}</span>
      <span className="text-ink-900">{value}</span>
    </div>
  );
}

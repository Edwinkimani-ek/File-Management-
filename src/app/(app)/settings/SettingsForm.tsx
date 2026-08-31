'use client';

import { useFormState } from 'react-dom';
import { updateFirmSettingsAction } from './actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import type { Firm } from '@/lib/types';

export function SettingsForm({ firm, logoSrc }: { firm: Firm; logoSrc: string | null }) {
  const [state, action] = useFormState(updateFirmSettingsAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="card space-y-4 p-4 sm:p-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div>
        <label className="label" htmlFor="name">Firm name</label>
        <input id="name" name="name" className="input" defaultValue={firm.name} required />
      </div>

      <div>
        <label className="label" htmlFor="address">Postal / physical address</label>
        <textarea id="address" name="address" className="input" rows={3}
                  defaultValue={firm.address ?? ''} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" className="input" defaultValue={firm.phone ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input"
                 defaultValue={firm.email ?? ''} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="default_limitation_years">
            Default limitation period (years)
          </label>
          <input id="default_limitation_years" name="default_limitation_years" type="number"
                 min={1} max={30} className="input"
                 defaultValue={firm.default_limitation_years} />
          <p className="mt-1 text-xs text-ink-500">
            Used to suggest a limitation deadline when a civil matter is opened. The advocate on
            the file must always verify the applicable period.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="vat_rate_percent">VAT rate (%)</label>
          <input id="vat_rate_percent" name="vat_rate_percent" type="number" step="0.01"
                 min={0} max={100} className="input"
                 defaultValue={(firm.vat_rate_bp / 100).toString()} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="logo">Letterhead logo</label>
        {logoSrc ? (
          <img src={logoSrc} alt="Current firm logo" className="mb-2 h-16 w-auto rounded border border-ink-200 bg-white p-1" />
        ) : null}
        <input id="logo" name="logo" type="file" accept="image/png,image/jpeg" className="input" />
        <p className="mt-1 text-xs text-ink-500">PNG or JPG, up to 2 MB. Appears on fee note PDFs.</p>
      </div>

      <SubmitButton pendingText="Saving…">Save settings</SubmitButton>

      {/* The seed script and the pre-pilot security checks both need this. */}
      <div className="border-t border-ink-200 pt-4">
        <p className="text-xs uppercase tracking-wide text-ink-500">Firm id</p>
        <p className="mt-1 select-all break-all font-mono text-xs text-ink-600">{firm.id}</p>
      </div>
    </form>
  );
}

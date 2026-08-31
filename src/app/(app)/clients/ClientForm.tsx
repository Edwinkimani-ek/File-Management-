'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState } from 'react-dom';
import { createClientAction, updateClientAction } from './actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { ConflictPanel } from '@/components/conflict/ConflictPanel';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { CLIENT_TYPE_LABELS, entries } from '@/lib/labels';
import type { Client } from '@/lib/types';

export function ClientForm({ client }: { client?: Client }) {
  const [state, action] = useFormState(
    client ? updateClientAction : createClientAction,
    EMPTY_FORM_STATE,
  );
  const [name, setName] = useState(client?.full_name ?? '');
  const [idNumber, setIdNumber] = useState(client?.id_number ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [type, setType] = useState(client?.type ?? 'individual');

  return (
    <form action={action} className="card space-y-4 p-4 sm:p-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {client ? <input type="hidden" name="client_id" value={client.id} /> : null}

      <div>
        <label className="label" htmlFor="type">Client type</label>
        <select id="type" name="type" className="input" value={type}
                onChange={(e) => setType(e.target.value as 'individual' | 'company')}>
          {entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="full_name">
          {type === 'company' ? 'Company name' : 'Full name'}
        </label>
        <input id="full_name" name="full_name" className="input" required value={name}
               onChange={(e) => setName(e.target.value)} />
      </div>

      <ConflictPanel name={name} idNumber={idNumber} phone={phone} excludeClientId={client?.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="id_number">
            {type === 'company' ? 'Company registration number' : 'National ID number'}
          </label>
          <input id="id_number" name="id_number" className="input" value={idNumber}
                 onChange={(e) => setIdNumber(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="kra_pin">KRA PIN</label>
          <input id="kra_pin" name="kra_pin" className="input"
                 defaultValue={client?.kra_pin ?? ''} placeholder="Optional" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" className="input" value={phone}
                 onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input"
                 defaultValue={client?.email ?? ''} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="physical_address">Physical address</label>
        <textarea id="physical_address" name="physical_address" className="input" rows={2}
                  defaultValue={client?.physical_address ?? ''} />
      </div>

      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" className="input" rows={3}
                  defaultValue={client?.notes ?? ''} />
      </div>

      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…">
          {client ? 'Save changes' : 'Create client'}
        </SubmitButton>
        <Link href={client ? `/clients/${client.id}` : '/clients'} className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

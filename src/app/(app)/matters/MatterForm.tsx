'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useFormState } from 'react-dom';
import {
  createMatterAction, suggestFileReferenceAction, updateMatterAction,
} from './actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { ConflictPanel } from '@/components/conflict/ConflictPanel';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import {
  MATTER_STATUS_LABELS, PRACTICE_AREA_LABELS, VISIBILITY_LABELS, entries,
} from '@/lib/labels';
import { referencePrefix } from '@/lib/references';
import { addYearsToIsoDate, formatDate } from '@/lib/dates';
import type { AppUser, Matter, PracticeArea } from '@/lib/types';

interface ClientOption {
  id: string;
  full_name: string;
}

export function MatterForm({
  clients,
  users,
  firmName,
  defaultLimitationYears,
  matter,
  defaultClientId,
  currentUserId,
}: {
  clients: ClientOption[];
  users: AppUser[];
  firmName: string;
  defaultLimitationYears: number;
  matter?: Matter;
  defaultClientId?: string;
  currentUserId: string;
}) {
  const [state, action] = useFormState(
    matter ? updateMatterAction : createMatterAction,
    EMPTY_FORM_STATE,
  );

  const [practiceArea, setPracticeArea] = useState<PracticeArea>(
    matter?.practice_area ?? 'civil_litigation',
  );
  const [fileReference, setFileReference] = useState(matter?.file_reference ?? '');
  const [opposingParty, setOpposingParty] = useState(matter?.opposing_party ?? '');
  const [causeOfActionDate, setCauseOfActionDate] = useState(matter?.cause_of_action_date ?? '');
  const [limitationYears, setLimitationYears] = useState(String(defaultLimitationYears));
  const [createLimitation, setCreateLimitation] = useState(false);
  const [suggesting, startSuggest] = useTransition();

  const suggest = () => {
    startSuggest(async () => {
      const value = await suggestFileReferenceAction(referencePrefix(firmName, practiceArea));
      if (value) setFileReference(value);
    });
  };

  // On a new matter, fill the reference in as soon as we know the area.
  useEffect(() => {
    if (matter || fileReference) return;
    suggest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceArea]);

  const isCivil = practiceArea === 'civil_litigation';
  const limitationDate =
    causeOfActionDate && Number(limitationYears) > 0
      ? addYearsToIsoDate(causeOfActionDate, Number(limitationYears))
      : null;

  return (
    <form action={action} className="space-y-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {matter ? <input type="hidden" name="matter_id" value={matter.id} /> : null}

      <section className="card space-y-4 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-800">The file</h2>

        <div>
          <label className="label" htmlFor="client_id">Client</label>
          <select id="client_id" name="client_id" className="input" required
                  defaultValue={matter?.client_id ?? defaultClientId ?? ''}>
            <option value="" disabled>Choose a client…</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.full_name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-500">
            Not listed?{' '}
            <Link href="/clients/new" className="text-brand-700 hover:underline">Add the client first</Link>.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="practice_area">Practice area</label>
          <select id="practice_area" name="practice_area" className="input" value={practiceArea}
                  onChange={(e) => setPracticeArea(e.target.value as PracticeArea)}>
            {entries(PRACTICE_AREA_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="file_reference">File reference</label>
          <div className="flex gap-2">
            <input id="file_reference" name="file_reference" className="input" required
                   value={fileReference} onChange={(e) => setFileReference(e.target.value)}
                   placeholder="KM/CIV/045/2026" />
            <button type="button" className="btn-secondary shrink-0" onClick={suggest}
                    disabled={suggesting}>
              {suggesting ? '…' : 'Suggest'}
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-500">
            The firm’s own file number. The suggestion is only a suggestion — override it freely.
            It must be unique within the firm.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" className="input" required
                 defaultValue={matter?.title ?? ''}
                 placeholder="Wanjiku v Kenya Power — claim for damages" />
        </div>

        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" className="input" rows={3}
                    defaultValue={matter?.description ?? ''} />
        </div>
      </section>

      <section className="card space-y-4 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-800">Court and other side</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="court_station">Court station</label>
            <input id="court_station" name="court_station" className="input"
                   defaultValue={matter?.court_station ?? ''} placeholder="Milimani Law Courts" />
          </div>
          <div>
            <label className="label" htmlFor="court_case_number">Court case number</label>
            <input id="court_case_number" name="court_case_number" className="input"
                   defaultValue={matter?.court_case_number ?? ''}
                   placeholder="Added once the matter is filed" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="opposing_party">Opposing party</label>
          <input id="opposing_party" name="opposing_party" className="input"
                 value={opposingParty} onChange={(e) => setOpposingParty(e.target.value)} />
        </div>

        <ConflictPanel name={opposingParty} />

        <div>
          <label className="label" htmlFor="opposing_advocates">Opposing advocates</label>
          <input id="opposing_advocates" name="opposing_advocates" className="input"
                 defaultValue={matter?.opposing_advocates ?? ''} />
        </div>
      </section>

      <section className="card space-y-4 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-800">Conduct of the file</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="assigned_to">Assigned advocate</label>
            <select id="assigned_to" name="assigned_to" className="input"
                    defaultValue={matter?.assigned_to ?? currentUserId}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="visibility">Visibility</label>
            <select id="visibility" name="visibility" className="input"
                    defaultValue={matter?.visibility ?? 'assigned_only'}>
              {entries(VISIBILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-500">
              Firm-wide matters are visible to every associate. Partners see everything either way.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="date_opened">Date opened</label>
            <input id="date_opened" name="date_opened" type="date" className="input"
                   defaultValue={matter?.date_opened ?? ''} />
          </div>
          {matter ? (
            <div>
              <label className="label" htmlFor="status">Status</label>
              <select id="status" name="status" className="input" defaultValue={matter.status}
                      disabled={matter.status === 'closed'}>
                <option value="active">{MATTER_STATUS_LABELS.active}</option>
                <option value="dormant">{MATTER_STATUS_LABELS.dormant}</option>
                {matter.status === 'closed' ? (
                  <option value="closed">{MATTER_STATUS_LABELS.closed}</option>
                ) : null}
              </select>
            </div>
          ) : null}
        </div>
      </section>

      {isCivil ? (
        <section className="card space-y-4 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-ink-800">Limitation period</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="cause_of_action_date">Cause of action date</label>
              <input id="cause_of_action_date" name="cause_of_action_date" type="date"
                     className="input" value={causeOfActionDate}
                     onChange={(e) => setCauseOfActionDate(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="limitation_years">Limitation period (years)</label>
              <input id="limitation_years" name="limitation_years" type="number" min={1} max={30}
                     className="input" value={limitationYears}
                     onChange={(e) => setLimitationYears(e.target.value)} />
            </div>
          </div>

          {!matter && causeOfActionDate ? (
            <label className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <input type="checkbox" name="create_limitation_event" className="mt-1"
                     checked={createLimitation}
                     onChange={(e) => setCreateLimitation(e.target.checked)} />
              <span>
                Add a limitation deadline to the diary for{' '}
                <strong>{limitationDate ? formatDate(limitationDate) : '—'}</strong>.
                <span className="mt-1 block text-xs">
                  This is an arithmetic aid only. The advocate on the file must verify the
                  limitation period that actually applies to this claim — it varies by cause of
                  action, and by whether a public body is the defendant.
                </span>
              </span>
            </label>
          ) : null}
        </section>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…">
          {matter ? 'Save changes' : 'Open matter'}
        </SubmitButton>
        <Link href={matter ? `/matters/${matter.id}` : '/matters'} className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

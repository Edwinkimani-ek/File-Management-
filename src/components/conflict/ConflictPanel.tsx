'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';
import { checkClientAction } from '@/app/(app)/clients/actions';

interface Duplicate {
  id: string;
  full_name: string;
  reason: string;
}

interface Conflict {
  kind: string;
  label: string;
  matter_id: string | null;
  file_reference: string | null;
  matter_title: string | null;
}

const KIND_LABELS: Record<string, string> = {
  client: 'an existing client',
  opposing_party: 'an opposing party',
  opposing_advocates: 'opposing advocates',
};

/**
 * Live duplicate and conflict check. It watches the name / ID / phone
 * fields on the form it sits in and warns before the record is saved —
 * a conflict is worth catching at the point of opening the file, not
 * after.
 */
export function ConflictPanel({
  name,
  idNumber,
  phone,
  excludeClientId,
}: {
  name: string;
  idNumber?: string;
  phone?: string;
  excludeClientId?: string;
}) {
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed.length < 3 && !idNumber?.trim() && !phone?.trim()) {
      setDuplicates([]);
      setConflicts([]);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const result = await checkClientAction({
            name: trimmed,
            idNumber,
            phone,
            excludeClientId,
          });
          setDuplicates(result.duplicates);
          setConflicts(result.conflicts);
        } catch {
          // A failed check must never block the form; the advocate can
          // still save and run a conflict search from the client page.
        }
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [name, idNumber, phone, excludeClientId]);

  if (duplicates.length === 0 && conflicts.length === 0) return null;

  return (
    <div className="space-y-3">
      {duplicates.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Possible duplicate
          </p>
          <ul className="mt-2 space-y-1">
            {duplicates.map((duplicate) => (
              <li key={duplicate.id}>
                <Link href={`/clients/${duplicate.id}`} className="underline" target="_blank">
                  {duplicate.full_name}
                </Link>{' '}
                already has {duplicate.reason}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Possible conflict of interest
          </p>
          <ul className="mt-2 space-y-1">
            {conflicts.map((conflict, index) => (
              <li key={`${conflict.kind}-${conflict.matter_id ?? index}`}>
                <span className="font-medium">{conflict.label}</span> is already on file as{' '}
                {KIND_LABELS[conflict.kind] ?? conflict.kind}
                {conflict.matter_id ? (
                  <>
                    {' '}on{' '}
                    <Link
                      href={`/matters/${conflict.matter_id}`}
                      className="underline"
                      target="_blank"
                    >
                      {conflict.file_reference} — {conflict.matter_title}
                    </Link>
                  </>
                ) : null}
                .
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Check this before taking instructions. You can still proceed if the firm is satisfied
            there is no conflict.
          </p>
        </div>
      ) : null}
    </div>
  );
}

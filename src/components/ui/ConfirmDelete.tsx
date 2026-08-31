'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { SubmitButton } from '@/components/ui/SubmitButton';

/**
 * Two-step delete. Nothing here is ever destructive — every delete in
 * Phase 1 sets deleted_at — but a file disappearing from the list without
 * warning is still alarming, so it asks first.
 */
export function ConfirmDelete({
  action,
  hidden,
  label,
  confirmLabel,
  question,
}: {
  action: (data: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  label: string;
  confirmLabel: string;
  question: string;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className="btn-danger" onClick={() => setAsking(true)}>
        <Trash2 className="h-4 w-4" /> {label}
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 rounded-md border border-red-300 bg-red-50 p-2">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <span className="text-sm text-red-800">{question}</span>
      <SubmitButton className="btn-danger" pendingText="Deleting…">{confirmLabel}</SubmitButton>
      <button type="button" className="btn-secondary" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </form>
  );
}

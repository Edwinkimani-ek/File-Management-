'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { DiaryEventForm, type MatterOption } from '@/components/diary/DiaryEventForm';
import type { AppUser } from '@/lib/types';

export function AddEventPanel({
  users,
  matters,
  fixedMatterId,
  currentUserId,
  label = 'New diary entry',
}: {
  users: AppUser[];
  matters?: MatterOption[];
  fixedMatterId?: string;
  currentUserId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {label}
      </button>
    );
  }

  return (
    <div className="card w-full">
      <h2 className="border-b border-ink-200 px-4 py-3 text-sm font-semibold text-ink-800">
        {label}
      </h2>
      <DiaryEventForm
        users={users}
        matters={matters}
        fixedMatterId={fixedMatterId}
        currentUserId={currentUserId}
        onDone={() => setOpen(false)}
      />
    </div>
  );
}

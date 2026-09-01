'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({
  children,
  className = 'btn-primary',
  pendingText,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? (pendingText ?? 'Working…') : children}
    </button>
  );
}

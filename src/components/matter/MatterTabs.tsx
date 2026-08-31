'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function MatterTabs({
  matterId,
  showFeeNotes,
}: {
  matterId: string;
  showFeeNotes: boolean;
}) {
  const pathname = usePathname();
  const base = `/matters/${matterId}`;

  const tabs = [
    { href: base, label: 'Documents' },
    { href: `${base}/diary`, label: 'Diary' },
    ...(showFeeNotes ? [{ href: `${base}/fee-notes`, label: 'Fee notes' }] : []),
    { href: `${base}/activity`, label: 'Activity' },
  ];

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-ink-200">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${
              active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-800'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

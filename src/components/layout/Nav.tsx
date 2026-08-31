'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Briefcase, CalendarDays, LayoutDashboard, Menu, Receipt, Settings,
  Users2, UserSquare2, X, LineChart,
} from 'lucide-react';
import type { UserRole } from '@/lib/types';
import { can } from '@/lib/permissions';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show: (role: UserRole) => boolean;
}

const ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: () => true },
  { href: '/matters', label: 'Matters', icon: Briefcase, show: () => true },
  { href: '/clients', label: 'Clients', icon: UserSquare2, show: () => true },
  { href: '/diary', label: 'Court diary', icon: CalendarDays, show: () => true },
  { href: '/fee-notes', label: 'Fee notes', icon: Receipt, show: (r) => can(r).seeMoney },
  { href: '/reports', label: 'Reports', icon: LineChart, show: (r) => can(r).viewReports },
  { href: '/users', label: 'Users', icon: Users2, show: (r) => can(r).manageUsers },
  { href: '/settings', label: 'Firm settings', icon: Settings, show: (r) => can(r).editFirmSettings },
];

export function Nav({
  role,
  firmName,
  userName,
  signOut,
}: {
  role: UserRole;
  firmName: string;
  userName: string;
  signOut: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = ITEMS.filter((item) => item.show(role));

  const link = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
          active ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-ink-100'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {item.label}
      </Link>
    );
  };

  return (
    <>
      {/* Phone: a top bar with a slide-down menu. Advocates open this
          one-handed in a corridor, so the targets stay large. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200 bg-white px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="min-w-0">
          <span className="text-lg font-semibold text-brand-700">Wakili</span>
          <span className="ml-2 truncate text-xs text-ink-500">{firmName}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 text-ink-700 hover:bg-ink-100"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {open ? (
        <nav className="border-b border-ink-200 bg-white p-3 lg:hidden">
          <div className="space-y-1">{items.map(link)}</div>
          <div className="mt-3 border-t border-ink-200 pt-3">
            <p className="px-3 text-xs text-ink-500">{userName}</p>
            <div className="mt-2 px-3">{signOut}</div>
          </div>
        </nav>
      ) : null}

      {/* Desktop sidebar. */}
      <aside className="hidden w-64 shrink-0 border-r border-ink-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-ink-200 px-5 py-4">
          <Link href="/dashboard">
            <span className="text-xl font-semibold tracking-tight text-brand-700">Wakili</span>
          </Link>
          <p className="mt-1 truncate text-xs text-ink-500">{firmName}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">{items.map(link)}</nav>
        <div className="border-t border-ink-200 p-3">
          <p className="truncate px-3 text-sm font-medium text-ink-800">{userName}</p>
          <p className="mb-2 px-3 text-xs capitalize text-ink-500">{role}</p>
          <div className="px-3">{signOut}</div>
        </div>
      </aside>
    </>
  );
}

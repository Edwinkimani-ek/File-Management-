import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const TIME_ZONE = 'Africa/Nairobi';

/** Kenyan convention: DD/MM/YYYY. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseLoose(value) : value;
  if (!date) return '—';
  return formatInTimeZone(date, TIME_ZONE, 'dd/MM/yyyy');
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseLoose(value) : value;
  if (!date) return '—';
  return formatInTimeZone(date, TIME_ZONE, 'dd/MM/yyyy HH:mm');
}

export function formatLongDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseLoose(value) : value;
  if (!date) return '—';
  return formatInTimeZone(date, TIME_ZONE, 'EEEE d MMMM yyyy');
}

/** "14:30:00" -> "14:30" */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 5);
}

/** Today in Nairobi, as YYYY-MM-DD. */
export function todayInNairobi(): string {
  return formatInTimeZone(new Date(), TIME_ZONE, 'yyyy-MM-dd');
}

/** Adds whole days to a YYYY-MM-DD string without leaving the date domain. */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function addYearsToIsoDate(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(y + years, m - 1, d));
  return utc.toISOString().slice(0, 10);
}

/** Whole days from today (Nairobi) to a YYYY-MM-DD date. Negative = past. */
export function daysUntil(isoDate: string): number {
  const today = todayInNairobi();
  const a = Date.UTC(...(today.split('-').map(Number) as [number, number, number]));
  const b = Date.UTC(...(isoDate.split('-').map(Number) as [number, number, number]));
  return Math.round((b - a) / 86400000);
}

export function nairobiNow(): Date {
  return toZonedTime(new Date(), TIME_ZONE);
}

function parseLoose(value: string): Date | null {
  // Bare YYYY-MM-DD is a calendar date; anchoring it at UTC noon keeps it
  // on the same day once it is rendered in Nairobi.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00Z`);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

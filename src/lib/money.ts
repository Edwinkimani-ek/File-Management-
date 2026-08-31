/**
 * Money is held everywhere as an integer number of KES cents. Nothing in
 * this file may produce a float that gets stored.
 */

const FORMATTER = new Intl.NumberFormat('en-KE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 15000000 -> "KSh 150,000.00" */
export function formatKes(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}KSh ${FORMATTER.format(Math.abs(cents) / 100)}`;
}

/** 15000000 -> "150,000.00" (for table columns that carry their own header) */
export function formatKesPlain(cents: number): string {
  return FORMATTER.format(cents / 100);
}

/**
 * Parses user input ("150,000", "150000.50", "KSh 1,200") into cents.
 * Returns null when the input is not a usable amount.
 */
export function parseKesToCents(input: string): number | null {
  const cleaned = String(input).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

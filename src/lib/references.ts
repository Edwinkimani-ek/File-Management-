import type { PracticeArea } from '@/lib/types';

export const PRACTICE_AREA_CODES: Record<PracticeArea, string> = {
  civil_litigation: 'CIV',
  criminal: 'CRIM',
  conveyancing: 'CONV',
  family: 'FAM',
  employment: 'EMP',
  commercial: 'COM',
  succession: 'SUCC',
  other: 'GEN',
};

/**
 * A short firm code for file references — the first two letters of the
 * firm's first word, so "Kimani & Company Advocates" gives KM/CIV/045/2026.
 * Only ever a suggestion; the firm's own numbering always wins.
 */
export function firmCode(firmName: string): string {
  const word = firmName.trim().split(/\s+/)[0] ?? 'FIRM';
  const letters = word.replace(/[^A-Za-z]/g, '').toUpperCase();
  return (letters.slice(0, 2) || 'FM');
}

export function referencePrefix(firmName: string, area: PracticeArea): string {
  return `${firmCode(firmName)}/${PRACTICE_AREA_CODES[area]}`;
}

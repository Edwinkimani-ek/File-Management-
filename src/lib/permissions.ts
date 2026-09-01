import type { UserRole } from '@/lib/types';

/**
 * What a role may do, as far as the interface is concerned. Every one of
 * these has a matching row-level security policy behind it; this exists so
 * the UI does not offer buttons that the database would refuse.
 */
export function can(role: UserRole) {
  return {
    manageUsers: role === 'partner',
    editFirmSettings: role === 'partner',
    seeMoney: role === 'partner' || role === 'associate',
    approveFeeNotes: role === 'partner',
    createMatters: role === 'partner' || role === 'associate',
    createClients: role === 'partner' || role === 'associate',
    createDiaryEvents: role === 'partner' || role === 'associate',
    deleteRecords: role === 'partner',
    viewReports: role === 'partner',
    closeMatters: role === 'partner' || role === 'associate',
    manageTemplates: role === 'partner',
  };
}

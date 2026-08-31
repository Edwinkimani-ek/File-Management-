/** Shape returned by every server action that a form binds to. */
export interface FormState {
  error?: string;
  success?: string;
}

export const EMPTY_FORM_STATE: FormState = {};

export function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function optionalText(data: FormData, key: string): string | null {
  const value = text(data, key);
  return value === '' ? null : value;
}

export function bool(data: FormData, key: string): boolean {
  return data.get(key) === 'on' || data.get(key) === 'true';
}

/**
 * Turns a Postgres error into something an advocate can act on. Anything
 * unrecognised is passed through rather than swallowed, so a real bug is
 * still visible during the pilot.
 */
export function friendlyDbError(message: string): string {
  if (message.includes('matters_firm_file_ref_idx')) {
    return 'That file reference is already used by another matter in this firm. Choose a different one.';
  }
  if (message.includes('users_firm_email_idx')) {
    return 'Someone with that email address is already a user in this firm.';
  }
  if (message.includes('new row violates row-level security')) {
    // Postgres checks the row an update produces against the same
    // policies, so this is usually someone moving a record out of their
    // own reach — an associate reassigning their file to a colleague, say.
    return 'That change would put this record out of your reach, so it has been refused. A partner can make it for you.';
  }
  if (message.includes('row-level security') || message.includes('42501')) {
    return 'You do not have permission to do that.';
  }
  return message;
}

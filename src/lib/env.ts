/**
 * Explains what is wrong with a credential, or null if it looks usable.
 *
 * The case worth catching by name: dashboards display secrets masked as
 * bullets, and it is easy to copy the dots instead of the value. That
 * produces a header a fetch cannot encode, and the runtime reports it as
 * "Cannot convert argument to a ByteString…" — which says nothing about
 * which variable is at fault or what to do. So we say it plainly here.
 */
export function describeCredentialProblem(
  name: string,
  value: string | undefined,
): string | null {
  if (!value || value.trim() === '') {
    return `${name} is not set. Add it to your environment and redeploy.`;
  }

  const masking = /[•●∙·*]/.exec(value);
  if (masking) {
    return (
      `${name} contains a "${masking[0]}" character, which means the masked ` +
      `display was copied rather than the value itself. In the Supabase ` +
      `dashboard go to Project Settings → API, reveal the key, and use its ` +
      `copy button.`
    );
  }

  // HTTP header values are Latin-1. Anything above U+00FF cannot be sent,
  // and in practice means the value was mangled somewhere in transit.
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) > 255) {
      return (
        `${name} contains a character at position ${i + 1} that cannot be ` +
        `sent in a request header. Re-copy it from the Supabase dashboard.`
      );
    }
  }

  if (/\s/.test(value)) {
    return `${name} contains a space or line break. Re-copy it without surrounding whitespace.`;
  }

  return null;
}

function required(name: string, value: string | undefined): string {
  const problem = describeCredentialProblem(name, value);
  if (problem) throw new Error(problem);
  return value as string;
}

export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get supabaseServiceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  },
  get siteUrl() {
    return (
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    );
  },
  get resendApiKey() {
    return process.env.RESEND_API_KEY;
  },
  get mailFrom() {
    return process.env.MAIL_FROM ?? 'Wakili <onboarding@resend.dev>';
  },
  get cronSecret() {
    return process.env.CRON_SECRET;
  },
};

import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { signedUrl } from '@/lib/storage';
import { PageHeader } from '@/components/ui/PageHeader';
import { SettingsForm } from './SettingsForm';

export const metadata = { title: 'Firm settings · Wakili' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { firm } = await requireRole('partner');
  const supabase = createClient();

  const logoSrc = firm.logo_url
    ? await signedUrl(supabase, 'logos', firm.logo_url, { expiresIn: 3600 })
    : null;

  return (
    <>
      <PageHeader
        title="Firm settings"
        subtitle="These details appear on your fee notes and in reminder emails."
      />
      <div className="max-w-2xl">
        <SettingsForm firm={firm} logoSrc={logoSrc} />
      </div>
    </>
  );
}

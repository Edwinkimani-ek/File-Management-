'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { optionalText, text, type FormState } from '@/lib/forms';
import { safeFileName } from '@/lib/uploads';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function updateFirmSettingsAction(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const { firm } = await requireRole('partner');
  const supabase = createClient();

  const name = text(data, 'name');
  if (!name) return { error: 'The firm needs a name.' };

  const limitationYears = Number(text(data, 'default_limitation_years') || '3');
  if (!Number.isInteger(limitationYears) || limitationYears < 1 || limitationYears > 30) {
    return { error: 'The default limitation period must be a whole number of years, 1 to 30.' };
  }

  const vatPercent = Number(text(data, 'vat_rate_percent') || '16');
  if (!Number.isFinite(vatPercent) || vatPercent < 0 || vatPercent > 100) {
    return { error: 'VAT must be a percentage between 0 and 100.' };
  }

  const update: Record<string, unknown> = {
    name,
    address: optionalText(data, 'address'),
    phone: optionalText(data, 'phone'),
    email: optionalText(data, 'email'),
    default_limitation_years: limitationYears,
    vat_rate_bp: Math.round(vatPercent * 100),
  };

  const logo = data.get('logo');
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) {
      return { error: 'The logo must be 2 MB or smaller.' };
    }
    if (logo.type !== 'image/png' && logo.type !== 'image/jpeg') {
      return { error: 'The logo must be a PNG or JPG.' };
    }
    const path = `${firm.id}/${Date.now()}-${safeFileName(logo.name)}`;
    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(path, logo, { contentType: logo.type, upsert: false });
    if (uploadError) return { error: `Could not upload the logo: ${uploadError.message}` };
    update.logo_url = path;
  }

  const { error } = await supabase.from('firms').update(update).eq('id', firm.id);
  if (error) return { error: error.message };

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: 'Firm settings saved.' };
}

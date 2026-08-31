-- =====================================================================
-- Demo data.
--
-- TWO firms on purpose. The pre-pilot security checklist is largely about
-- proving that a user of one cannot reach anything belonging to the
-- other, and that test needs a second tenant to point at.
--
-- This file creates the firms and their records only. The matching auth
-- users (and therefore the passwords you sign in with) are created by
-- scripts/seed.mjs, which calls the Supabase admin API. Run that; it
-- applies this file for you.
--
-- NEVER run this against production. The pilot definition of done
-- requires demo data to be absent there.
-- =====================================================================

begin;

-- Firm A ---------------------------------------------------------------
insert into public.firms (id, name, address, phone, email, default_limitation_years)
values (
  '11111111-1111-4111-8111-111111111111',
  'Kimani & Company Advocates',
  'Bishops Garden Towers, 3rd Floor\nBishops Road, Upper Hill\nP.O. Box 40123–00100, Nairobi',
  '+254 20 271 4400',
  'admin@kimaniadvocates.co.ke',
  3
)
on conflict (id) do nothing;

-- Firm B ---------------------------------------------------------------
insert into public.firms (id, name, address, phone, email)
values (
  '22222222-2222-4222-8222-222222222222',
  'Ochieng, Mwangi & Associates',
  'Reinsurance Plaza, 8th Floor\nOginga Odinga Street\nP.O. Box 1290–40100, Kisumu',
  '+254 57 202 3311',
  'info@ochiengmwangi.co.ke'
)
on conflict (id) do nothing;

commit;

-- =====================================================================
-- Demo data for one firm — for pasting into the Supabase SQL editor.
--
-- HOW TO USE
--   1. Register the firm through the app's own signup screen, and invite
--      an associate and a clerk from Users. Accounts are created there,
--      not here: this script never touches Supabase's auth tables.
--   2. In the app, go to Users and copy the PARTNER's id — the grey
--      monospaced line under their email. Paste it on the marked line
--      below.
--   3. Paste this whole file into the SQL editor and run it.
--
-- Run it again with the OTHER firm's partner id to fill in a second
-- tenant. You need two: the security checklist asks you to try reaching
-- one firm's records while signed in as the other, and that needs a real
-- second firm with real ids.
--
-- Running it twice for the same firm is harmless — it checks first and
-- stops if that firm already has matters.
--
-- WHY IT ASKS FOR AN ID RATHER THAN AN EMAIL
--   Row-level security is FORCED on every table, so whether a plain
--   SELECT works here depends on whether the SQL editor's database role
--   bypasses RLS — which varies, and cannot be relied on. So the script
--   adopts the partner's identity first, using the id you paste, and
--   then does every lookup and insert through exactly the same policies
--   the application uses. It works either way, and it doubles as proof
--   that those policies allow the real flows on this project.
-- =====================================================================

do $$
declare
  -- ------------------------------------------------------------------
  -- EDIT THIS LINE: the partner's id, copied from the app's Users page.
  v_partner uuid := '00000000-0000-0000-0000-000000000000';
  -- ------------------------------------------------------------------

  v_firm      uuid;
  v_assoc     uuid;
  v_assoc2    uuid;
  v_clerk     uuid;
  v_firm_name text;

  v_client_person  uuid;
  v_client_company uuid;
  v_client_third   uuid;

  v_matter_civil   uuid;
  v_matter_conv    uuid;
  v_matter_emp     uuid;

  v_fee_draft uuid;
  v_fee_sent  uuid;
  v_fee_paid  uuid;
  v_total     integer;

  v_prefix text;
  v_year  integer := extract(year from (now() at time zone 'Africa/Nairobi'))::int;
  v_today date    := (now() at time zone 'Africa/Nairobi')::date;
begin
  -- Adopt the partner's identity before touching anything, so that every
  -- read and write below goes through the ordinary policies rather than
  -- depending on this connection's privileges.
  perform set_config('request.jwt.claim.sub', v_partner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  -- ---------------------------------------------------------- look-ups
  select f.id, f.name into v_firm, v_firm_name from public.firms f;

  -- First two letters of the firm's first word, as the app's own file
  -- reference suggestion does: "Kimani & Co Advocates" gives KM/CIV/045.
  -- Each firm therefore gets its own prefix, so the two demo firms cannot
  -- be mistaken for each other during the cross-firm checks.
  v_prefix := upper(substring(
    regexp_replace(split_part(coalesce(v_firm_name, 'Firm'), ' ', 1), '[^A-Za-z]', '', 'g')
    from 1 for 2));
  if coalesce(v_prefix, '') = '' then v_prefix := 'FM'; end if;

  if v_firm is null then
    execute 'reset role';
    raise exception
      'That id did not resolve to an active partner. Copy the grey monospaced id from under the partner''s email on the app''s Users page, and paste it on the marked line. (Given: %)',
      v_partner;
  end if;

  -- Colleagues are optional; anything unassigned falls back to the
  -- partner so the script still works before the invites are accepted.
  select id into v_assoc from public.users
   where firm_id = v_firm and role = 'associate' and status = 'active'
   order by created_at limit 1;
  select id into v_assoc2 from public.users
   where firm_id = v_firm and role = 'associate' and status = 'active'
     and id is distinct from v_assoc
   order by created_at limit 1;
  select id into v_clerk from public.users
   where firm_id = v_firm and role = 'clerk' and status = 'active'
   order by created_at limit 1;

  v_assoc  := coalesce(v_assoc, v_partner);
  v_assoc2 := coalesce(v_assoc2, v_assoc);
  v_clerk  := coalesce(v_clerk, v_partner);

  if exists (select 1 from public.matters where firm_id = v_firm) then
    execute 'reset role';
    raise notice 'Firm "%" already has matters on file. Nothing was changed.', v_firm_name;
    return;
  end if;

  -- --------------------------------------------------------- clients
  insert into public.clients
    (firm_id, type, full_name, id_number, kra_pin, phone, email, physical_address, created_by)
  values (v_firm, 'individual', 'Mary Wanjiku Kariuki', '21458796', 'A004587963X',
          '+254 733 445 566', 'mwanjiku@example.co.ke',
          'House 14, Kiambu Road, Nairobi', v_partner)
  returning id into v_client_person;

  insert into public.clients
    (firm_id, type, full_name, id_number, kra_pin, phone, email, physical_address, created_by)
  values (v_firm, 'company', 'Sunrise Millers Limited', 'CPR/2015/198442', 'P051234567M',
          '+254 20 555 1200', 'legal@sunrisemillers.co.ke',
          'Industrial Area, Nairobi', v_partner)
  returning id into v_client_company;

  insert into public.clients
    (firm_id, type, full_name, id_number, phone, created_by)
  values (v_firm, 'individual', 'Joseph Mutiso Mwendwa', '30114522',
          '+254 711 909 090', v_partner)
  returning id into v_client_third;

  -- --------------------------------------------------------- matters
  -- Assigned to the associate and visible to them alone. This is the
  -- file the cross-role checks turn on.
  insert into public.matters
    (firm_id, file_reference, client_id, title, practice_area, court_station,
     court_case_number, opposing_party, opposing_advocates, status, assigned_to,
     visibility, date_opened, cause_of_action_date, description, created_by)
  values (v_firm, v_prefix || '/CIV/045/' || v_year, v_client_person,
          'Wanjiku v Kenya Power & Lighting Co. — claim for damages',
          'civil_litigation', 'Milimani Law Courts', 'HCCC E' || v_year || '/238',
          'Kenya Power & Lighting Company PLC', 'Mbogo, Wafula & Partners Advocates',
          'active', v_assoc, 'assigned_only', v_today - 120, v_today - 400,
          'Claim for special and general damages arising from injuries sustained on 12 May.',
          v_partner)
  returning id into v_matter_civil;

  -- Firm-wide, so every associate sees it.
  insert into public.matters
    (firm_id, file_reference, client_id, title, practice_area, opposing_party,
     opposing_advocates, status, assigned_to, visibility, date_opened, description, created_by)
  values (v_firm, v_prefix || '/CONV/012/' || v_year, v_client_company,
          'Sunrise Millers — purchase of LR 209/14582, Industrial Area',
          'conveyancing', 'Hillside Properties Limited', 'Achieng & Co. Advocates',
          'active', v_partner, 'firm_wide', v_today - 60,
          'Acting for the purchaser. Completion documents with the vendor.', v_partner)
  returning id into v_matter_conv;

  -- The other associate's file: assigned-only, so associate one must not
  -- see it anywhere.
  insert into public.matters
    (firm_id, file_reference, client_id, title, practice_area, court_station,
     court_case_number, opposing_party, status, assigned_to, visibility,
     date_opened, created_by)
  values (v_firm, v_prefix || '/EMP/003/' || v_year, v_client_third,
          'Mwendwa v Bluewave Logistics — unfair termination',
          'employment', 'Employment and Labour Relations Court, Nairobi',
          'ELRC E' || v_year || '/91', 'Bluewave Logistics Limited',
          'active', v_assoc2, 'assigned_only', v_today - 30, v_partner)
  returning id into v_matter_emp;

  -- A file assigned to the clerk, so their (deliberately narrow) view is
  -- not simply empty.
  insert into public.matters
    (firm_id, file_reference, client_id, title, practice_area, status,
     assigned_to, visibility, date_opened, created_by)
  values (v_firm, v_prefix || '/CONV/013/' || v_year, v_client_company,
          'Sunrise Millers — lease of warehouse premises', 'conveyancing',
          'active', v_clerk, 'assigned_only', v_today - 15, v_partner);

  -- A closed file, so the read-only rule has something to act on.
  insert into public.matters
    (firm_id, file_reference, client_id, title, practice_area, court_station,
     status, assigned_to, visibility, date_opened, date_closed, closing_note, created_by)
  values (v_firm, v_prefix || '/SUCC/007/' || (v_year - 1), v_client_person,
          'Estate of the late Samuel Kariuki — grant of letters of administration',
          'succession', 'Milimani Law Courts', 'closed', v_partner, 'firm_wide',
          v_today - 600, v_today - 40,
          'Grant confirmed and distributed. File to archive.', v_partner);

  -- ----------------------------------------------------------- diary
  insert into public.diary_events
    (firm_id, matter_id, title, event_type, event_date, event_time, court_station,
     assigned_to, reminder_days_before, created_by)
  values
    (v_firm, v_matter_civil, 'Hearing — plaintiff''s case', 'hearing',
     v_today + 3, '09:00', 'Milimani Law Courts', v_assoc, '{7,3,1}', v_partner),
    (v_firm, v_matter_civil, 'File and serve witness statements', 'filing_deadline',
     v_today + 1, null, null, v_assoc, '{7,3,1}', v_partner),
    (v_firm, v_matter_conv, 'Completion meeting with vendor''s advocates', 'client_meeting',
     v_today + 6, '14:30', null, v_partner, '{3,1}', v_partner),
    (v_firm, v_matter_emp, 'Mention — directions', 'mention',
     v_today + 12, '09:00', 'Employment and Labour Relations Court, Nairobi',
     v_assoc2, '{7,3,1}', v_partner),
    (v_firm, v_matter_conv, 'Chase vendor''s completion documents', 'other',
     v_today - 4, null, null, v_partner, '{3,1}', v_partner);

  insert into public.diary_events
    (firm_id, matter_id, title, event_type, event_date, assigned_to,
     reminder_days_before, created_by, outcome_notes)
  values (v_firm, v_matter_civil, 'Limitation deadline — Wanjiku claim',
          'limitation_deadline', v_today + 695, v_assoc, '{90,30,7}', v_partner,
          'Calculated as 3 years from the cause of action. The advocate on the file ' ||
          'must verify the applicable limitation period for this claim.');

  -- ------------------------------------------------------- fee notes
  -- Amounts are KES cents. 5000000 = KSh 50,000.00
  insert into public.fee_notes
    (firm_id, matter_id, client_id, line_items, vat_applicable, created_by)
  values (v_firm, v_matter_civil, v_client_person,
          '[{"description":"Instructions to sue; perusal of documents","amount":5000000},
             {"description":"Drawing plaint, verifying affidavit and list of documents","amount":3500000},
             {"description":"Filing fees and court disbursements","amount":1250000}]'::jsonb,
          true, v_assoc)
  returning id into v_fee_draft;

  insert into public.fee_notes
    (firm_id, matter_id, client_id, line_items, vat_applicable, created_by, notes)
  values (v_firm, v_matter_conv, v_client_company,
          '[{"description":"Perusal of sale agreement and title documents","amount":7500000},
             {"description":"Attending Lands Registry; registration of transfer","amount":4000000}]'::jsonb,
          true, v_partner,
          'Payable within 30 days. M-Pesa paybill 400200, account SUNRISE.')
  returning id into v_fee_sent;

  insert into public.fee_notes
    (firm_id, matter_id, client_id, line_items, vat_applicable, created_by)
  values (v_firm, v_matter_emp, v_client_third,
          '[{"description":"Instructions to file claim; drawing memorandum","amount":4000000}]'::jsonb,
          false, v_assoc2)
  returning id into v_fee_paid;

  -- Move two of them through the workflow. The triggers do the
  -- arithmetic and the attribution, exactly as they will in the pilot.
  update public.fee_notes set status = 'approved' where id in (v_fee_sent, v_fee_paid);
  update public.fee_notes set status = 'sent'     where id in (v_fee_sent, v_fee_paid);

  -- -------------------------------------------------------- payments
  select total into v_total from public.fee_notes where id = v_fee_sent;
  insert into public.payments (firm_id, fee_note_id, amount, method, reference, payment_date)
  values (v_firm, v_fee_sent, round(v_total / 2.0), 'mpesa', 'SFK4TR9QW1', v_today - 7);

  select total into v_total from public.fee_notes where id = v_fee_paid;
  insert into public.payments (firm_id, fee_note_id, amount, method, reference, payment_date)
  values (v_firm, v_fee_paid, v_total, 'bank', 'FT26031400921', v_today - 3);

  execute 'reset role';

  raise notice '---------------------------------------------------------------';
  raise notice 'Seeded "%"', v_firm_name;
  raise notice '  5 matters (one closed, one assigned to the clerk)';
  raise notice '  3 clients, 6 diary entries, 3 fee notes, 2 payments';
  raise notice '  Fee notes: one draft, one part-paid, one paid in full';
  raise notice '---------------------------------------------------------------';
  raise notice 'Firm id for the cross-firm checks: %', v_firm;
end;
$$;

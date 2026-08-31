-- =====================================================================
-- Policy and trigger tests.
--
-- These run against a throwaway Postgres carrying the shim in
-- 00_local_supabase_shim.sql — see scripts/test-db.sh. They assert the
-- rules the pilot depends on (tenancy, the three roles, the fee note
-- workflow) at the layer that actually enforces them, rather than
-- through the interface that merely reflects it.
--
-- Any failure raises, so a non-zero exit from psql means a rule broke.
-- =====================================================================

\set ON_ERROR_STOP on
set client_min_messages to notice;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.assert(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then
    raise notice '  ok   %', description;
  else
    raise exception 'FAILED: %', description;
  end if;
end;
$$;

-- Impersonate a signed-in user exactly as PostgREST does: set the JWT
-- claims, then drop into the `authenticated` role so RLS applies.
create or replace function tests.act_as(p_user uuid)
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  execute 'set role authenticated';
end;
$$;

create or replace function tests.as_service()
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', '', false);
end;
$$;

/** How many rows a statement actually touched. A policy that filters a
    row out makes an UPDATE or DELETE affect nothing rather than raise. */
create or replace function tests.affected(p_sql text)
returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

/** True when the statement was refused — by a policy, or by a trigger. */
create or replace function tests.refuses(p_sql text)
returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- =====================================================================
-- Fixtures. Written as the service role, which is how signup and the
-- seed script write them in the real system.
-- =====================================================================
select tests.as_service();

\set firm_a '11111111-1111-4111-8111-111111111111'
\set firm_b '22222222-2222-4222-8222-222222222222'
\set partner_a 'aaaaaaa1-1111-4111-8111-111111111111'
\set assoc_a 'aaaaaaa2-1111-4111-8111-111111111111'
\set assoc_a2 'aaaaaaa3-1111-4111-8111-111111111111'
\set clerk_a 'aaaaaaa4-1111-4111-8111-111111111111'
\set gone_a 'aaaaaaa5-1111-4111-8111-111111111111'
\set partner_b 'bbbbbbb1-2222-4222-8222-222222222222'

insert into auth.users (id, email) values
  (:'partner_a', 'partner@firma.test'),
  (:'assoc_a',   'associate@firma.test'),
  (:'assoc_a2',  'associate2@firma.test'),
  (:'clerk_a',   'clerk@firma.test'),
  (:'gone_a',    'gone@firma.test'),
  (:'partner_b', 'partner@firmb.test');

insert into public.firms (id, name) values
  (:'firm_a', 'Kimani & Company Advocates'),
  (:'firm_b', 'Ochieng, Mwangi & Associates');

insert into public.users (id, firm_id, full_name, email, role, status) values
  (:'partner_a', :'firm_a', 'Grace Kimani',  'partner@firma.test',   'partner',   'active'),
  (:'assoc_a',   :'firm_a', 'Brian Otieno',  'associate@firma.test', 'associate', 'active'),
  (:'assoc_a2',  :'firm_a', 'Fatuma Hassan', 'associate2@firma.test','associate', 'active'),
  (:'clerk_a',   :'firm_a', 'Peter Njoroge', 'clerk@firma.test',     'clerk',     'active'),
  (:'gone_a',    :'firm_a', 'Former Staff',  'gone@firma.test',      'associate', 'disabled'),
  (:'partner_b', :'firm_b', 'Alice Ochieng', 'partner@firmb.test',   'partner',   'active');

insert into public.clients (id, firm_id, type, full_name, id_number, created_by) values
  ('c1111111-1111-4111-8111-111111111111', :'firm_a', 'individual',
   'Mary Wanjiku Kariuki', '21458796', :'partner_a'),
  ('c2222222-2222-4222-8222-222222222222', :'firm_b', 'individual',
   'Rose Atieno Odhiambo', '28776541', :'partner_b');

insert into public.matters
  (id, firm_id, file_reference, client_id, title, practice_area, opposing_party,
   status, assigned_to, visibility, created_by)
values
  -- Assigned to the first associate, visible to them alone.
  ('11110000-1111-4111-8111-000000000001', :'firm_a', 'KM/CIV/045/2026',
   'c1111111-1111-4111-8111-111111111111', 'Wanjiku v Kenya Power',
   'civil_litigation', 'Kenya Power & Lighting Company PLC',
   'active', :'assoc_a', 'assigned_only', :'partner_a'),
  -- Firm-wide, so every associate sees it.
  ('11110000-1111-4111-8111-000000000002', :'firm_a', 'KM/CONV/012/2026',
   'c1111111-1111-4111-8111-111111111111', 'Sunrise Millers — purchase',
   'conveyancing', 'Hillside Properties Limited',
   'active', :'partner_a', 'firm_wide', :'partner_a'),
  -- The other associate's file: assigned-only, so associate 1 must not see it.
  ('11110000-1111-4111-8111-000000000003', :'firm_a', 'KM/EMP/003/2026',
   'c1111111-1111-4111-8111-111111111111', 'Mwendwa v Bluewave',
   'employment', 'Bluewave Logistics Limited',
   'active', :'assoc_a2', 'assigned_only', :'assoc_a2'),
  -- Firm B's file.
  ('22220000-2222-4222-8222-000000000001', :'firm_b', 'OM/CIV/019/2026',
   'c2222222-2222-4222-8222-222222222222', 'Odhiambo v Lakeside Sacco',
   'civil_litigation', 'Lakeside Sacco Society Limited',
   'active', :'partner_b', 'firm_wide', :'partner_b');

insert into public.documents
  (id, firm_id, matter_id, file_name, storage_path, mime_type, category, uploaded_by)
values
  ('d1111111-1111-4111-8111-111111111111', :'firm_a',
   '11110000-1111-4111-8111-000000000001', 'plaint.pdf',
   :'firm_a' || '/11110000-1111-4111-8111-000000000001/aaa-plaint.pdf',
   'application/pdf', 'pleading', :'assoc_a'),
  ('d2222222-2222-4222-8222-222222222222', :'firm_b',
   '22220000-2222-4222-8222-000000000001', 'demand.pdf',
   :'firm_b' || '/22220000-2222-4222-8222-000000000001/bbb-demand.pdf',
   'application/pdf', 'correspondence', :'partner_b');

insert into storage.objects (bucket_id, name) values
  ('documents', :'firm_a' || '/11110000-1111-4111-8111-000000000001/aaa-plaint.pdf'),
  ('documents', :'firm_b' || '/22220000-2222-4222-8222-000000000001/bbb-demand.pdf');


-- =====================================================================
\echo ''
\echo 'Tenancy — a user of one firm reaches nothing belonging to another'
-- =====================================================================
select tests.act_as(:'partner_a');

select tests.assert(
  (select count(*) from public.matters where firm_id = :'firm_b') = 0,
  'Firm A partner sees no Firm B matter');
select tests.assert(
  (select count(*) from public.clients where firm_id = :'firm_b') = 0,
  'Firm A partner sees no Firm B client');
select tests.assert(
  (select count(*) from public.documents where firm_id = :'firm_b') = 0,
  'Firm A partner sees no Firm B document');
select tests.assert(
  (select count(*) from public.users where firm_id = :'firm_b') = 0,
  'Firm A partner sees no Firm B user');
select tests.assert(
  (select count(*) from public.firms where id = :'firm_b') = 0,
  'Firm A partner cannot read the Firm B record itself');

-- Reading nothing is half of it; writing across the boundary is the half
-- people forget to check.
select tests.assert(
  tests.affected($$update public.matters set title = 'tampered'
                   where id = '22220000-2222-4222-8222-000000000001'$$) = 0,
  'Firm A partner cannot update a Firm B matter');

select tests.assert(
  tests.refuses($$insert into public.matters
      (firm_id, file_reference, client_id, title, created_by)
    values ('22222222-2222-4222-8222-222222222222', 'X/1/2026',
            'c2222222-2222-4222-8222-222222222222', 'planted',
            'aaaaaaa1-1111-4111-8111-111111111111')$$),
  'Firm A partner cannot plant a matter inside Firm B');

select tests.assert(
  (select count(*) from storage.objects
   where bucket_id = 'documents' and name like '22222222%') = 0,
  'Firm A partner cannot list a Firm B storage object');


-- =====================================================================
\echo ''
\echo 'Roles — what each of the three can see'
-- =====================================================================
select tests.act_as(:'assoc_a');

select tests.assert(
  (select count(*) from public.matters) = 2,
  'Associate sees exactly their assigned matter plus the firm-wide one');
select tests.assert(
  (select count(*) from public.matters
   where id = '11110000-1111-4111-8111-000000000003') = 0,
  'Associate cannot see another associate''s assigned-only matter');
select tests.assert(
  (select count(*) from public.documents
   where matter_id = '11110000-1111-4111-8111-000000000003') = 0,
  'Associate cannot see documents on a matter they are not on');

select tests.act_as(:'clerk_a');

select tests.assert(
  (select count(*) from public.matters) = 0,
  'Clerk sees no matter they are not assigned to, firm-wide or otherwise');
select tests.assert(
  (select count(*) from public.clients) = 1,
  'Clerk can read the firm''s clients — they need the contact details');
select tests.assert(
  tests.refuses($$insert into public.clients (firm_id, full_name)
                  values ('11111111-1111-4111-8111-111111111111', 'New Client')$$),
  'Clerk cannot create a client');
select tests.assert(
  tests.refuses($$insert into public.diary_events
      (firm_id, title, event_type, event_date)
    values ('11111111-1111-4111-8111-111111111111', 'Hearing', 'hearing', current_date)$$),
  'Clerk cannot write to the diary');

select tests.act_as(:'partner_a');
update public.matters set assigned_to = 'aaaaaaa4-1111-4111-8111-111111111111'
where id = '11110000-1111-4111-8111-000000000002';

select tests.act_as(:'clerk_a');
select tests.assert(
  (select count(*) from public.matters) = 1,
  'Clerk sees a matter once it is assigned to them');


-- =====================================================================
\echo ''
\echo 'A disabled user is refused everywhere, at once'
-- =====================================================================
select tests.act_as(:'gone_a');

select tests.assert(app.firm_id() is null, 'Disabled user has no firm');
select tests.assert((select count(*) from public.matters) = 0,
  'Disabled user sees no matters');
select tests.assert((select count(*) from public.clients) = 0,
  'Disabled user sees no clients');
select tests.assert((select count(*) from public.users) = 0,
  'Disabled user cannot even see their own colleagues');


-- =====================================================================
\echo ''
\echo 'Matters — unique file references, and closing'
-- =====================================================================
select tests.act_as(:'partner_a');

select tests.assert(
  tests.refuses($$insert into public.matters
      (firm_id, file_reference, client_id, title, created_by)
    values ('11111111-1111-4111-8111-111111111111', 'km/civ/045/2026',
            'c1111111-1111-4111-8111-111111111111', 'Duplicate',
            'aaaaaaa1-1111-4111-8111-111111111111')$$),
  'A duplicate file reference is rejected, case-insensitively');

-- The same reference in another firm is fine — it is unique per firm.
select tests.as_service();
insert into public.matters (firm_id, file_reference, client_id, title, created_by)
values (:'firm_b', 'KM/CIV/045/2026', 'c2222222-2222-4222-8222-222222222222',
        'Same reference, other firm', :'partner_b');
select tests.assert(true, 'The same file reference is allowed in a different firm');

select tests.act_as(:'partner_a');
select tests.assert(
  tests.refuses($$update public.matters set status = 'closed'
                  where id = '11110000-1111-4111-8111-000000000001'$$),
  'Closing a matter without a closing note is refused');

update public.matters
set status = 'closed', closing_note = 'Judgment delivered; decree extracted.'
where id = '11110000-1111-4111-8111-000000000001';
select tests.assert(
  (select date_closed from public.matters
   where id = '11110000-1111-4111-8111-000000000001') is not null,
  'Closing a matter with a note sets the closing date');

select tests.act_as(:'assoc_a');
select tests.assert(
  tests.refuses($$insert into public.documents
      (firm_id, matter_id, file_name, storage_path, category, uploaded_by)
    values ('11111111-1111-4111-8111-111111111111',
            '11110000-1111-4111-8111-000000000001', 'late.pdf', 'x/y/late.pdf',
            'pleading', 'aaaaaaa2-1111-4111-8111-111111111111')$$),
  'An associate cannot file a document on a closed matter');
select tests.assert(
  tests.refuses($$insert into public.diary_events
      (firm_id, matter_id, title, event_type, event_date)
    values ('11111111-1111-4111-8111-111111111111',
            '11110000-1111-4111-8111-000000000001', 'Mention', 'mention', current_date)$$),
  'An associate cannot diarise on a closed matter');

select tests.act_as(:'partner_a');
insert into public.documents
  (firm_id, matter_id, file_name, storage_path, category, uploaded_by)
values ('11111111-1111-4111-8111-111111111111',
        '11110000-1111-4111-8111-000000000001', 'decree.pdf',
        '11111111-1111-4111-8111-111111111111/11110000-1111-4111-8111-000000000001/ccc-decree.pdf',
        'court_order', 'aaaaaaa1-1111-4111-8111-111111111111');
select tests.assert(true, 'A partner can still file on a closed matter');

-- Reopen it so the fee note tests below are not fighting a closed file.
update public.matters set status = 'active'
where id = '11110000-1111-4111-8111-000000000001';


-- =====================================================================
\echo ''
\echo 'Documents — soft delete is partner-only'
-- =====================================================================
select tests.act_as(:'assoc_a');
select tests.assert(
  tests.refuses($$update public.documents set deleted_at = now()
                  where id = 'd1111111-1111-4111-8111-111111111111'$$),
  'An associate cannot delete a document');

select tests.act_as(:'partner_a');
update public.documents set deleted_at = now()
where id = 'd1111111-1111-4111-8111-111111111111';
select tests.assert(
  (select deleted_at from public.documents
   where id = 'd1111111-1111-4111-8111-111111111111') is not null,
  'A partner can delete a document, and the row survives — the delete is soft');

-- Postgres re-checks the SELECT policies against the row an update
-- produces. That is why a deleted record stays readable by a partner: if
-- it did not, setting deleted_at would refuse itself. Everyone else
-- loses sight of it, and every list query filters deleted_at anyway.
select tests.act_as(:'assoc_a');
select tests.assert(
  (select count(*) from public.documents
   where id = 'd1111111-1111-4111-8111-111111111111') = 0,
  'A deleted document is gone for everyone but a partner');


-- =====================================================================
\echo ''
\echo 'Fee notes — numbering, arithmetic, approval, payment'
-- =====================================================================
select tests.act_as(:'assoc_a');

insert into public.fee_notes
  (id, firm_id, matter_id, client_id, line_items, vat_applicable, created_by)
values (
  'f1111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '11110000-1111-4111-8111-000000000001',
  'c1111111-1111-4111-8111-111111111111',
  '[{"description":"Instructions to sue","amount":5000000},
    {"description":"Drawing plaint","amount":3500000}]'::jsonb,
  true,
  'aaaaaaa2-1111-4111-8111-111111111111');

select tests.assert(
  (select fee_note_number from public.fee_notes
   where id = 'f1111111-1111-4111-8111-111111111111')
    = 'FN-' || extract(year from now() at time zone 'Africa/Nairobi')::int || '-0001',
  'The first fee note of the year is numbered FN-YYYY-0001');

select tests.assert(
  (select subtotal from public.fee_notes
   where id = 'f1111111-1111-4111-8111-111111111111') = 8500000,
  'The subtotal is summed from the line items');
select tests.assert(
  (select vat_amount from public.fee_notes
   where id = 'f1111111-1111-4111-8111-111111111111') = 1360000,
  'VAT at 16% is computed on the subtotal');
select tests.assert(
  (select total from public.fee_notes
   where id = 'f1111111-1111-4111-8111-111111111111') = 9860000,
  'The total is subtotal plus VAT — KSh 98,600.00');

-- A caller posting its own totals gets them thrown away and recomputed.
update public.fee_notes set subtotal = 1, vat_amount = 1, total = 1,
  line_items = '[{"description":"Instructions to sue","amount":5000000},
                 {"description":"Drawing plaint","amount":3500000}]'::jsonb
where id = 'f1111111-1111-4111-8111-111111111111';
select tests.assert(
  (select total from public.fee_notes
   where id = 'f1111111-1111-4111-8111-111111111111') = 9860000,
  'A posted total that does not match its lines is discarded');

select tests.assert(
  (select status from public.fee_notes
   where id = 'f1111111-1111-4111-8111-111111111111') = 'draft',
  'A new fee note starts as a draft');

-- The acceptance test: approval must fail for an associate even when the
-- interface is bypassed entirely and the column is set directly.
select tests.assert(
  tests.refuses($$update public.fee_notes set status = 'approved'
                  where id = 'f1111111-1111-4111-8111-111111111111'$$),
  'An associate cannot approve a fee note, even by setting the column');

select tests.assert(
  tests.refuses($$insert into public.payments (firm_id, fee_note_id, amount, method)
    values ('11111111-1111-4111-8111-111111111111',
            'f1111111-1111-4111-8111-111111111111', 100, 'mpesa')$$),
  'A payment cannot be recorded against a draft fee note');

select tests.act_as(:'clerk_a');
select tests.assert(
  (select count(*) from public.fee_notes) = 0,
  'A clerk sees no fee note at all — not a filtered view, none');
select tests.assert(
  (select count(*) from public.payments) = 0,
  'A clerk sees no payment at all');

select tests.act_as(:'partner_a');
update public.fee_notes set status = 'approved'
where id = 'f1111111-1111-4111-8111-111111111111';
select tests.assert(
  (select approved_by from public.fee_notes
   where id = 'f1111111-1111-4111-8111-111111111111') = :'partner_a',
  'A partner can approve, and the approval is attributed to them');
select tests.assert(
  (select count(*) from public.activity_log
   where action = 'fee_note.approved') = 1,
  'The approval is written to the activity log by the database itself');

select tests.assert(
  tests.refuses($$update public.fee_notes
    set line_items = '[{"description":"Padded","amount":99000000}]'::jsonb
    where id = 'f1111111-1111-4111-8111-111111111111'$$),
  'Line items cannot be changed after approval');

update public.fee_notes set status = 'sent'
where id = 'f1111111-1111-4111-8111-111111111111';

insert into public.payments (firm_id, fee_note_id, amount, method, reference)
values ('11111111-1111-4111-8111-111111111111',
        'f1111111-1111-4111-8111-111111111111', 4860000, 'mpesa', 'SFK4TR9QW1');
select tests.assert(
  (select status from public.fee_notes
   where id = 'f1111111-1111-4111-8111-111111111111') = 'partially_paid',
  'A part payment moves the fee note to partially paid');

insert into public.payments (firm_id, fee_note_id, amount, method, reference)
values ('11111111-1111-4111-8111-111111111111',
        'f1111111-1111-4111-8111-111111111111', 5000000, 'bank', 'FT2603140092');
select tests.assert(
  (select status from public.fee_notes
   where id = 'f1111111-1111-4111-8111-111111111111') = 'paid',
  'Payments summing to the total flip the status to paid, unprompted');
select tests.assert(
  (select amount_paid from public.fee_notes
   where id = 'f1111111-1111-4111-8111-111111111111') = 9860000,
  'The paid figure equals the sum of the payments');

select tests.assert(
  tests.refuses($$update public.fee_notes set amount_paid = 0
                  where id = 'f1111111-1111-4111-8111-111111111111'$$)
  or (select amount_paid from public.fee_notes
      where id = 'f1111111-1111-4111-8111-111111111111') = 9860000,
  'The paid figure cannot be edited by hand');

-- Numbering continues per firm, and Firm B starts its own run at 0001.
insert into public.fee_notes (firm_id, matter_id, client_id, line_items, created_by)
values ('11111111-1111-4111-8111-111111111111',
        '11110000-1111-4111-8111-000000000002',
        'c1111111-1111-4111-8111-111111111111',
        '[{"description":"Perusal","amount":1000000}]'::jsonb, :'partner_a');
select tests.assert(
  (select count(*) from public.fee_notes
   where fee_note_number like 'FN-%-0002') = 1,
  'Fee note numbering continues within the firm');

select tests.act_as(:'partner_b');
insert into public.fee_notes (firm_id, matter_id, client_id, line_items, created_by)
values ('22222222-2222-4222-8222-222222222222',
        '22220000-2222-4222-8222-000000000001',
        'c2222222-2222-4222-8222-222222222222',
        '[{"description":"Demand letter","amount":2500000}]'::jsonb, :'partner_b');
select tests.assert(
  (select fee_note_number from public.fee_notes
   where firm_id = '22222222-2222-4222-8222-222222222222')
    like 'FN-%-0001',
  'Each firm has its own numbering run');


-- =====================================================================
\echo ''
\echo 'The activity log is append-only'
-- =====================================================================
select tests.act_as(:'partner_a');

select tests.assert(
  tests.affected($$delete from public.activity_log
                   where action = 'fee_note.approved'$$) = 0,
  'Nobody can delete an activity log entry');
select tests.assert(
  tests.affected($$update public.activity_log set action = 'nothing.happened'
                   where action = 'fee_note.approved'$$) = 0,
  'Nobody can rewrite an activity log entry');
select tests.assert(
  tests.refuses($$insert into public.activity_log
      (firm_id, user_id, action, entity_type)
    values ('11111111-1111-4111-8111-111111111111',
            'aaaaaaa2-1111-4111-8111-111111111111', 'forged', 'matter')$$),
  'A log entry cannot be written in someone else''s name');


-- =====================================================================
\echo ''
\echo 'Conflict check reaches across the whole firm, and no further'
-- =====================================================================
select tests.act_as(:'assoc_a');

select tests.assert(
  (select count(*) from public.conflict_check('Kenya Power')
   where kind = 'opposing_party') >= 1,
  'A name matching an opposing party is reported as a conflict');
select tests.assert(
  (select file_reference from public.conflict_check('Kenya Power')
   where kind = 'opposing_party' limit 1) = 'KM/CIV/045/2026',
  'The conflict names the matter it is on');
select tests.assert(
  (select count(*) from public.conflict_check('Bluewave')) >= 1,
  'The check covers matters the caller cannot themselves open');
select tests.assert(
  (select count(*) from public.conflict_check('Lakeside')) = 0,
  'The check never crosses into another firm');
select tests.assert(
  (select count(*) from public.conflict_check('Wanjiku')
   where kind = 'client') = 1,
  'An existing client with the same name is reported too');


-- =====================================================================
\echo ''
\echo 'The firm keeps at least one active partner'
-- =====================================================================
select tests.act_as(:'partner_a');
select tests.assert(
  tests.refuses($$update public.users set role = 'associate'
                  where id = 'aaaaaaa1-1111-4111-8111-111111111111'$$),
  'The last active partner cannot demote themselves');

select tests.as_service();
\echo ''
\echo 'All database tests passed.'

-- =====================================================================
-- Business rules that must hold no matter which client is talking to the
-- database. Anything a forged API call could otherwise get away with is
-- enforced here, not in the UI.
-- =====================================================================

-- ------------------------------------------------ FN-YYYY-#### numbering
create or replace function app.next_fee_note_number(p_firm_id uuid, p_year integer)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  insert into public.fee_note_sequences (firm_id, year, last_number)
  values (p_firm_id, p_year, 1)
  on conflict (firm_id, year)
    do update set last_number = public.fee_note_sequences.last_number + 1
  returning last_number into n;

  return 'FN-' || p_year::text || '-' || lpad(n::text, 4, '0');
end;
$$;

-- ------------------------------------------------- fee note arithmetic
-- Totals are always recomputed from line_items; a caller cannot post a
-- total that does not match the lines it claims to be made of.
create or replace function public.fee_notes_recalculate()
returns trigger language plpgsql as $$
declare
  v_subtotal bigint := 0;
  v_rate     integer;
  v_item     jsonb;
begin
  if jsonb_typeof(new.line_items) <> 'array' then
    raise exception 'line_items must be a JSON array';
  end if;

  for v_item in select * from jsonb_array_elements(new.line_items) loop
    if jsonb_typeof(v_item -> 'amount') <> 'number' then
      raise exception 'every line item needs a numeric amount in KES cents';
    end if;
    if (v_item ->> 'amount')::numeric < 0 then
      raise exception 'line item amounts cannot be negative';
    end if;
    if (v_item ->> 'amount')::numeric <> floor((v_item ->> 'amount')::numeric) then
      raise exception 'line item amounts must be whole cents';
    end if;
    v_subtotal := v_subtotal + (v_item ->> 'amount')::bigint;
  end loop;

  select vat_rate_bp into v_rate from public.firms where id = new.firm_id;

  new.subtotal   := v_subtotal;
  new.vat_amount := case when new.vat_applicable
                         then round(v_subtotal * coalesce(v_rate, 1600) / 10000.0)
                         else 0 end;
  new.total      := new.subtotal + new.vat_amount;
  return new;
end;
$$;

create trigger fee_notes_recalculate_trg
  before insert or update of line_items, vat_applicable on public.fee_notes
  for each row execute function public.fee_notes_recalculate();

-- --------------------------------------------------- fee note workflow
create or replace function public.fee_notes_workflow()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.status          := 'draft';
    new.amount_paid     := 0;
    new.approved_by     := null;
    new.approved_at     := null;
    new.fee_note_number := app.next_fee_note_number(
      new.firm_id, extract(year from (now() at time zone 'Africa/Nairobi'))::int);
    return new;
  end if;

  -- payments_apply recomputes amount_paid and status from the payments
  -- ledger. That update is this trigger's own work, not a caller trying
  -- to set a status by hand, so it passes straight through.
  if coalesce(current_setting('wakili.applying_payment', true), '') = '1' then
    return new;
  end if;

  -- Numbers and ownership are immutable once issued.
  new.fee_note_number := old.fee_note_number;
  new.firm_id         := old.firm_id;
  new.matter_id       := old.matter_id;
  new.created_by      := old.created_by;

  -- Approval is a partner act. This is the server-side half of "the
  -- Approve button neither appears nor works via direct API call".
  if new.status = 'approved' and old.status <> 'approved' then
    if not (app.is_partner() or app.is_privileged()) then
      raise exception 'only a partner can approve a fee note'
        using errcode = '42501';
    end if;
    if old.status <> 'draft' then
      raise exception 'only a draft fee note can be approved';
    end if;
    new.approved_by := coalesce(auth.uid(), new.approved_by);
    new.approved_at := coalesce(new.approved_at, now());
  end if;

  -- Sending requires approval first.
  if new.status = 'sent' and old.status = 'draft' then
    raise exception 'a fee note must be approved before it is sent';
  end if;
  if new.status = 'sent' and old.status <> 'sent' then
    new.sent_at := coalesce(new.sent_at, now());
  end if;

  -- Reverting to draft un-approves, and only a partner may do it.
  if new.status = 'draft' and old.status <> 'draft' then
    if not (app.is_partner() or app.is_privileged()) then
      raise exception 'only a partner can return a fee note to draft'
        using errcode = '42501';
    end if;
    if old.amount_paid > 0 then
      raise exception 'a fee note with payments recorded cannot return to draft';
    end if;
    new.approved_by := null;
    new.approved_at := null;
    new.sent_at     := null;
  end if;

  -- Line items freeze at approval.
  if old.status <> 'draft' and new.line_items is distinct from old.line_items then
    raise exception 'line items cannot change after approval';
  end if;

  -- Paid / partially paid, and the paid figure itself, are derived from
  -- the payments ledger and never set by hand.
  if new.status in ('paid', 'partially_paid') and old.status not in ('paid', 'partially_paid') then
    raise exception 'payment status follows recorded payments; record a payment instead';
  end if;
  new.amount_paid := old.amount_paid;

  return new;
end;
$$;

create trigger fee_notes_workflow_trg
  before insert or update on public.fee_notes
  for each row execute function public.fee_notes_workflow();

-- Log approvals for the audit trail.
create or replace function public.fee_notes_log_approval()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    insert into public.activity_log (firm_id, user_id, action, entity_type, entity_id, matter_id, detail)
    values (new.firm_id, auth.uid(), 'fee_note.approved', 'fee_note', new.id, new.matter_id,
            new.fee_note_number);
  end if;
  return null;
end;
$$;

create trigger fee_notes_log_approval_trg
  after update on public.fee_notes
  for each row execute function public.fee_notes_log_approval();

-- ------------------------------------------------------------ payments
-- Payments drive the fee note's status. Sum to the total and it flips to
-- paid on its own.
create or replace function public.payments_apply()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_fee_note_id uuid := coalesce(new.fee_note_id, old.fee_note_id);
  v_paid        bigint;
  v_note        public.fee_notes;
begin
  select * into v_note from public.fee_notes where id = v_fee_note_id for update;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments where fee_note_id = v_fee_note_id;

  perform set_config('wakili.applying_payment', '1', true);

  update public.fee_notes
  set amount_paid = v_paid,
      status = case
                 when v_paid >= v_note.total and v_note.total > 0 then 'paid'::public.fee_note_status
                 when v_paid > 0 then 'partially_paid'::public.fee_note_status
                 when v_note.status in ('paid', 'partially_paid') then 'sent'::public.fee_note_status
                 else v_note.status
               end
  where id = v_fee_note_id;

  perform set_config('wakili.applying_payment', '0', true);

  return null;
end;
$$;

create trigger payments_apply_trg
  after insert or update or delete on public.payments
  for each row execute function public.payments_apply();

-- A payment can only be recorded against a fee note that has been issued.
create or replace function public.payments_guard()
returns trigger language plpgsql as $$
declare
  v_status public.fee_note_status;
begin
  select status into v_status from public.fee_notes where id = new.fee_note_id;
  if v_status = 'draft' then
    raise exception 'approve the fee note before recording a payment against it';
  end if;
  new.recorded_by := coalesce(auth.uid(), new.recorded_by);
  return new;
end;
$$;

create trigger payments_guard_trg
  before insert on public.payments
  for each row execute function public.payments_guard();

-- ----------------------------------------------------------- documents
-- Soft delete only, and only by a partner.
create or replace function public.documents_guard()
returns trigger language plpgsql as $$
begin
  if new.deleted_at is not null and old.deleted_at is null
     and not (app.is_partner() or app.is_privileged()) then
    raise exception 'only a partner can delete a document' using errcode = '42501';
  end if;
  new.firm_id      := old.firm_id;
  new.matter_id    := old.matter_id;
  new.storage_path := old.storage_path;
  new.uploaded_by  := old.uploaded_by;
  return new;
end;
$$;

create trigger documents_guard_trg
  before update on public.documents
  for each row execute function public.documents_guard();

-- ------------------------------------------------------------- matters
create or replace function public.matters_guard()
returns trigger language plpgsql as $$
begin
  new.firm_id := old.firm_id;

  if new.deleted_at is not null and old.deleted_at is null then
    if not (app.is_partner() or app.is_privileged()) then
      raise exception 'only a partner can delete a matter' using errcode = '42501';
    end if;
    insert into public.activity_log (firm_id, user_id, action, entity_type, entity_id, matter_id, detail)
    values (old.firm_id, auth.uid(), 'matter.deleted', 'matter', old.id, old.id, old.file_reference);
  end if;

  if new.status = 'closed' and old.status <> 'closed' then
    if coalesce(btrim(new.closing_note), '') = '' then
      raise exception 'a closing note is required to close a matter';
    end if;
    new.date_closed := coalesce(new.date_closed,
                                (now() at time zone 'Africa/Nairobi')::date);
  end if;

  if new.status <> 'closed' and old.status = 'closed' then
    if not (app.is_partner() or app.is_privileged()) then
      raise exception 'only a partner can reopen a closed matter' using errcode = '42501';
    end if;
    new.date_closed := null;
  end if;

  return new;
end;
$$;

create trigger matters_guard_trg
  before update on public.matters
  for each row execute function public.matters_guard();

-- ------------------------------------------------------------- clients
create or replace function public.clients_guard()
returns trigger language plpgsql as $$
begin
  new.firm_id := old.firm_id;
  if new.deleted_at is not null and old.deleted_at is null
     and not (app.is_partner() or app.is_privileged()) then
    raise exception 'only a partner can delete a client' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger clients_guard_trg
  before update on public.clients
  for each row execute function public.clients_guard();

-- --------------------------------------------------------------- users
-- Keep at least one active partner, and log every role or status change.
create or replace function public.users_guard()
returns trigger language plpgsql as $$
declare
  v_partners integer;
begin
  new.firm_id := old.firm_id;
  new.id      := old.id;

  if (old.role = 'partner' and new.role <> 'partner')
     or (old.status = 'active' and new.status <> 'active' and old.role = 'partner') then
    select count(*) into v_partners from public.users
    where firm_id = old.firm_id and role = 'partner' and status = 'active' and id <> old.id;
    if v_partners = 0 then
      raise exception 'the firm must keep at least one active partner';
    end if;
  end if;

  if new.role <> old.role then
    insert into public.activity_log (firm_id, user_id, action, entity_type, entity_id, detail)
    values (old.firm_id, auth.uid(), 'user.role_changed', 'user', old.id,
            old.role::text || ' -> ' || new.role::text);
  end if;

  if new.status <> old.status then
    insert into public.activity_log (firm_id, user_id, action, entity_type, entity_id, detail)
    values (old.firm_id, auth.uid(), 'user.status_changed', 'user', old.id, new.status::text);
  end if;

  return new;
end;
$$;

create trigger users_guard_trg
  before update on public.users
  for each row execute function public.users_guard();

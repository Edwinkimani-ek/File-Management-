-- =====================================================================
-- Row level security. Enabled on every table, no exceptions.
-- The rule underneath all of it: firm_id must equal app.firm_id().
-- =====================================================================

alter table public.firms                enable row level security;
alter table public.users                enable row level security;
alter table public.invitations          enable row level security;
alter table public.clients              enable row level security;
alter table public.matters              enable row level security;
alter table public.documents            enable row level security;
alter table public.diary_events         enable row level security;
alter table public.diary_reminders_sent enable row level security;
alter table public.fee_notes            enable row level security;
alter table public.fee_note_sequences   enable row level security;
alter table public.payments             enable row level security;
alter table public.activity_log         enable row level security;

-- Lock these down further: even a leaked anon key gets nothing.
alter table public.firms                force row level security;
alter table public.users                force row level security;
alter table public.invitations          force row level security;
alter table public.clients              force row level security;
alter table public.matters              force row level security;
alter table public.documents            force row level security;
alter table public.diary_events         force row level security;
alter table public.fee_notes            force row level security;
alter table public.payments             force row level security;
alter table public.activity_log         force row level security;
alter table public.fee_note_sequences   force row level security;
alter table public.diary_reminders_sent force row level security;

-- --------------------------------------------------------------- firms
create policy firms_select on public.firms for select to authenticated
  using (id = app.firm_id());
create policy firms_update on public.firms for update to authenticated
  using (id = app.firm_id() and app.is_partner())
  with check (id = app.firm_id() and app.is_partner());
-- Firm rows are only ever created by the signup flow (service role).

-- --------------------------------------------------------------- users
-- Everyone in the firm can see their colleagues (needed to assign work);
-- only a partner may create, re-role or disable one.
create policy users_select on public.users for select to authenticated
  using (firm_id = app.firm_id());
create policy users_insert on public.users for insert to authenticated
  with check (firm_id = app.firm_id() and app.is_partner());
create policy users_update on public.users for update to authenticated
  using (firm_id = app.firm_id() and app.is_partner())
  with check (firm_id = app.firm_id() and app.is_partner());

-- --------------------------------------------------------- invitations
create policy invitations_select on public.invitations for select to authenticated
  using (firm_id = app.firm_id() and app.is_partner());
create policy invitations_insert on public.invitations for insert to authenticated
  with check (firm_id = app.firm_id() and app.is_partner());
create policy invitations_update on public.invitations for update to authenticated
  using (firm_id = app.firm_id() and app.is_partner())
  with check (firm_id = app.firm_id() and app.is_partner());

-- ------------------------------------------------------------- clients
-- All three roles may read a client record (a clerk needs the contact
-- details); the financial section is a separate table they cannot read.
create policy clients_select on public.clients for select to authenticated
  using (firm_id = app.firm_id() and deleted_at is null);
-- Postgres re-checks the SELECT policies against the row an UPDATE
-- produces, so a soft delete would refuse itself: setting deleted_at
-- makes the row fail clients_select. Partners — the only role allowed to
-- delete — can therefore still see a deleted record, which is also what
-- you want if one has to be looked at or restored. Application queries
-- filter deleted_at themselves, so nothing deleted appears in a list.
create policy clients_select_deleted on public.clients for select to authenticated
  using (firm_id = app.firm_id() and deleted_at is not null and app.is_partner());
create policy clients_insert on public.clients for insert to authenticated
  with check (firm_id = app.firm_id() and app.is_fee_earner());
create policy clients_update on public.clients for update to authenticated
  using (firm_id = app.firm_id() and app.is_fee_earner())
  with check (firm_id = app.firm_id() and app.is_fee_earner());

-- ------------------------------------------------------------- matters
create policy matters_select on public.matters for select to authenticated
  using (
    firm_id = app.firm_id() and deleted_at is null and (
      app.is_partner()
      or assigned_to = auth.uid()
      or (app.user_role() = 'associate' and visibility = 'firm_wide')
    )
  );
-- Same reason as clients_select_deleted above.
create policy matters_select_deleted on public.matters for select to authenticated
  using (firm_id = app.firm_id() and deleted_at is not null and app.is_partner());
create policy matters_insert on public.matters for insert to authenticated
  with check (firm_id = app.firm_id() and app.is_fee_earner());
create policy matters_update on public.matters for update to authenticated
  using (
    firm_id = app.firm_id() and (
      app.is_partner()
      or (status <> 'closed' and app.user_role() = 'associate'
          and (assigned_to = auth.uid() or visibility = 'firm_wide'))
    )
  )
  with check (firm_id = app.firm_id());

-- ----------------------------------------------------------- documents
create policy documents_select on public.documents for select to authenticated
  using (firm_id = app.firm_id() and deleted_at is null
         and app.can_see_matter(matter_id));
-- Same reason as clients_select_deleted above.
create policy documents_select_deleted on public.documents for select to authenticated
  using (firm_id = app.firm_id() and deleted_at is not null and app.is_partner());
create policy documents_insert on public.documents for insert to authenticated
  with check (firm_id = app.firm_id() and app.can_write_matter(matter_id));
-- Rename / re-categorise by anyone who can write the matter; the
-- soft-delete path sets deleted_at and is partner-only, enforced by the
-- documents_no_delete_by_non_partner trigger in 0004.
create policy documents_update on public.documents for update to authenticated
  using (firm_id = app.firm_id() and app.can_write_matter(matter_id))
  with check (firm_id = app.firm_id());

-- -------------------------------------------------------- diary_events
create policy diary_select on public.diary_events for select to authenticated
  using (
    firm_id = app.firm_id()
    and (matter_id is null or app.can_see_matter(matter_id))
  );
-- Clerks read the diary but do not write to it.
create policy diary_insert on public.diary_events for insert to authenticated
  with check (
    firm_id = app.firm_id() and app.is_fee_earner()
    and (matter_id is null or app.can_write_matter(matter_id))
  );
create policy diary_update on public.diary_events for update to authenticated
  using (
    firm_id = app.firm_id() and app.is_fee_earner()
    and (matter_id is null or app.can_write_matter(matter_id))
  )
  with check (firm_id = app.firm_id());

create policy diary_reminders_select on public.diary_reminders_sent
  for select to authenticated using (firm_id = app.firm_id() and app.is_partner());

-- ----------------------------------------------------------- fee_notes
-- Clerks get nothing at all here: no select policy applies to them.
create policy fee_notes_select on public.fee_notes for select to authenticated
  using (firm_id = app.firm_id() and app.can_see_money()
         and app.can_see_matter(matter_id));
create policy fee_notes_insert on public.fee_notes for insert to authenticated
  with check (firm_id = app.firm_id() and app.can_see_money()
              and app.can_write_matter(matter_id) and status = 'draft');
create policy fee_notes_update on public.fee_notes for update to authenticated
  using (firm_id = app.firm_id() and app.can_see_money()
         and app.can_write_matter(matter_id))
  with check (firm_id = app.firm_id());

create policy fee_note_sequences_all on public.fee_note_sequences
  for select to authenticated using (firm_id = app.firm_id());

-- ------------------------------------------------------------ payments
create policy payments_select on public.payments for select to authenticated
  using (
    firm_id = app.firm_id() and app.can_see_money()
    and exists (select 1 from public.fee_notes f
                where f.id = fee_note_id and app.can_see_matter(f.matter_id))
  );
create policy payments_insert on public.payments for insert to authenticated
  with check (
    firm_id = app.firm_id() and app.can_see_money()
    and exists (select 1 from public.fee_notes f
                where f.id = fee_note_id and app.can_see_matter(f.matter_id))
  );

-- -------------------------------------------------------- activity_log
-- Partners read the whole firm's log; everyone else reads the log of a
-- matter they can already see, plus their own actions.
create policy activity_select on public.activity_log for select to authenticated
  using (
    firm_id = app.firm_id() and (
      app.is_partner()
      or user_id = auth.uid()
      or (matter_id is not null and app.can_see_matter(matter_id))
    )
  );
create policy activity_insert on public.activity_log for insert to authenticated
  with check (firm_id = app.firm_id() and user_id = auth.uid());
-- No update or delete policy: the log is append-only.

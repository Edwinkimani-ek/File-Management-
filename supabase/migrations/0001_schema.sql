-- =====================================================================
-- Wakili Case Manager — Phase 1 schema
-- All money is stored in KES cents (integer). All timestamps are UTC;
-- the application renders them in Africa/Nairobi.
-- =====================================================================

create extension if not exists "pgcrypto";

-- Private schema for security helpers. Not exposed over PostgREST.
create schema if not exists app;

-- ---------------------------------------------------------------- enums
create type public.user_role         as enum ('partner', 'associate', 'clerk');
create type public.user_status       as enum ('active', 'disabled');
create type public.client_type       as enum ('individual', 'company');
create type public.practice_area     as enum (
  'civil_litigation', 'criminal', 'conveyancing', 'family',
  'employment', 'commercial', 'succession', 'other');
create type public.matter_status     as enum ('active', 'dormant', 'closed');
create type public.matter_visibility as enum ('assigned_only', 'firm_wide');
create type public.document_category as enum (
  'pleading', 'correspondence', 'court_order', 'attendance_note',
  'contract', 'evidence', 'other');
create type public.diary_event_type  as enum (
  'hearing', 'mention', 'filing_deadline', 'limitation_deadline',
  'client_meeting', 'other');
create type public.diary_event_status as enum ('upcoming', 'done', 'adjourned');
create type public.fee_note_status   as enum (
  'draft', 'approved', 'sent', 'paid', 'partially_paid');
create type public.payment_method    as enum ('mpesa', 'bank', 'cash', 'cheque');

-- --------------------------------------------------------------- firms
create table public.firms (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  address                  text,
  phone                    text,
  email                    text,
  logo_url                 text,
  -- Firm-editable defaults (Feature 5 limitation helper, Feature 6 VAT).
  default_limitation_years integer not null default 3
                             check (default_limitation_years between 1 and 30),
  vat_rate_bp              integer not null default 1600
                             check (vat_rate_bp between 0 and 10000),
  created_at               timestamptz not null default now()
);

-- --------------------------------------------------------------- users
-- One row per authenticated user. id mirrors auth.users.id.
create table public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  firm_id    uuid not null references public.firms (id) on delete cascade,
  full_name  text not null,
  email      text not null,
  phone      text,
  role       public.user_role not null default 'associate',
  status     public.user_status not null default 'active',
  created_at timestamptz not null default now()
);
create index users_firm_idx on public.users (firm_id);
create unique index users_firm_email_idx on public.users (firm_id, lower(email));

-- --------------------------------------------------------- invitations
-- Partner invites a colleague; the token is redeemed to set a password.
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms (id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        public.user_role not null,
  token_hash  text not null unique,
  invited_by  uuid references public.users (id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index invitations_firm_idx on public.invitations (firm_id);

-- ------------------------------------------------------------- clients
create table public.clients (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references public.firms (id) on delete cascade,
  type             public.client_type not null default 'individual',
  full_name        text not null,
  id_number        text,
  kra_pin          text,
  phone            text,
  email            text,
  physical_address text,
  notes            text,
  created_by       uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index clients_firm_idx on public.clients (firm_id) where deleted_at is null;
create index clients_name_idx on public.clients (firm_id, lower(full_name));
create index clients_id_number_idx on public.clients (firm_id, id_number)
  where id_number is not null and deleted_at is null;

-- ------------------------------------------------------------- matters
create table public.matters (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references public.firms (id) on delete cascade,
  file_reference     text not null,
  client_id          uuid not null references public.clients (id) on delete restrict,
  title              text not null,
  practice_area      public.practice_area not null default 'other',
  court_station      text,
  court_case_number  text,
  opposing_party     text,
  opposing_advocates text,
  status             public.matter_status not null default 'active',
  assigned_to        uuid references public.users (id) on delete set null,
  visibility         public.matter_visibility not null default 'assigned_only',
  date_opened        date not null default (now() at time zone 'Africa/Nairobi')::date,
  date_closed        date,
  closing_note       text,
  description        text,
  cause_of_action_date date,
  created_by         uuid references public.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
-- File reference must be unique inside a firm (Feature 3 acceptance test).
create unique index matters_firm_file_ref_idx
  on public.matters (firm_id, upper(file_reference)) where deleted_at is null;
create index matters_firm_idx on public.matters (firm_id) where deleted_at is null;
create index matters_client_idx on public.matters (client_id);
create index matters_assigned_idx on public.matters (assigned_to);
create index matters_opposing_idx on public.matters (firm_id, lower(opposing_party));

-- ----------------------------------------------------------- documents
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms (id) on delete cascade,
  matter_id    uuid not null references public.matters (id) on delete cascade,
  file_name    text not null,
  storage_path text not null unique,
  mime_type    text,
  size_bytes   bigint,
  category     public.document_category not null default 'other',
  uploaded_by  uuid references public.users (id) on delete set null,
  uploaded_at  timestamptz not null default now(),
  notes        text,
  deleted_at   timestamptz
);
create index documents_matter_idx on public.documents (matter_id) where deleted_at is null;
create index documents_firm_idx on public.documents (firm_id) where deleted_at is null;

-- -------------------------------------------------------- diary_events
create table public.diary_events (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references public.firms (id) on delete cascade,
  matter_id            uuid references public.matters (id) on delete cascade,
  title                text not null,
  event_type           public.diary_event_type not null default 'hearing',
  event_date           date not null,
  event_time           time,
  court_station        text,
  assigned_to          uuid references public.users (id) on delete set null,
  reminder_days_before integer[] not null default '{7,3,1}',
  status               public.diary_event_status not null default 'upcoming',
  outcome_notes        text,
  -- Adjournment history: an adjourned event points at its replacement.
  rescheduled_to       uuid references public.diary_events (id) on delete set null,
  rescheduled_from     uuid references public.diary_events (id) on delete set null,
  created_by           uuid references public.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index diary_firm_date_idx on public.diary_events (firm_id, event_date);
create index diary_matter_idx on public.diary_events (matter_id);
create index diary_assigned_idx on public.diary_events (assigned_to, event_date);

-- Sent-reminder ledger so the cron job never emails the same thing twice.
create table public.diary_reminders_sent (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms (id) on delete cascade,
  event_id   uuid not null references public.diary_events (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  kind       text not null,           -- 'lead:<n>' or 'digest:<yyyy-mm-dd>'
  sent_at    timestamptz not null default now(),
  unique (event_id, user_id, kind)
);

-- ----------------------------------------------------------- fee_notes
create table public.fee_notes (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references public.firms (id) on delete cascade,
  matter_id       uuid not null references public.matters (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete restrict,
  fee_note_number text,                    -- FN-YYYY-####, assigned by trigger
  line_items      jsonb not null default '[]'::jsonb,
  subtotal        integer not null default 0,  -- KES cents
  vat_applicable  boolean not null default false,
  vat_amount      integer not null default 0,
  total           integer not null default 0,
  status          public.fee_note_status not null default 'draft',
  amount_paid     integer not null default 0,
  notes           text,
  created_by      uuid references public.users (id) on delete set null,
  approved_by     uuid references public.users (id) on delete set null,
  approved_at     timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index fee_notes_number_idx
  on public.fee_notes (firm_id, fee_note_number) where fee_note_number is not null;
create index fee_notes_matter_idx on public.fee_notes (matter_id);
create index fee_notes_client_idx on public.fee_notes (client_id);

-- Per-firm, per-year counter behind FN-YYYY-####.
create table public.fee_note_sequences (
  firm_id     uuid not null references public.firms (id) on delete cascade,
  year        integer not null,
  last_number integer not null default 0,
  primary key (firm_id, year)
);

-- ------------------------------------------------------------ payments
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms (id) on delete cascade,
  fee_note_id  uuid not null references public.fee_notes (id) on delete cascade,
  amount       integer not null check (amount > 0),   -- KES cents
  method       public.payment_method not null,
  reference    text,
  payment_date date not null default (now() at time zone 'Africa/Nairobi')::date,
  recorded_by  uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index payments_fee_note_idx on public.payments (fee_note_id);

-- -------------------------------------------------------- activity_log
create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms (id) on delete cascade,
  user_id     uuid references public.users (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  matter_id   uuid references public.matters (id) on delete cascade,
  detail      text,
  created_at  timestamptz not null default now()
);
create index activity_firm_idx on public.activity_log (firm_id, created_at desc);
create index activity_matter_idx on public.activity_log (matter_id, created_at desc);

-- ------------------------------------------------------- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger clients_touch      before update on public.clients
  for each row execute function public.touch_updated_at();
create trigger matters_touch      before update on public.matters
  for each row execute function public.touch_updated_at();
create trigger diary_touch        before update on public.diary_events
  for each row execute function public.touch_updated_at();
create trigger fee_notes_touch    before update on public.fee_notes
  for each row execute function public.touch_updated_at();

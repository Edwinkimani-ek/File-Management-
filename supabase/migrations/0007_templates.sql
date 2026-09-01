-- =====================================================================
-- Templates library (Feature 7)
-- Per-firm document templates. Partners manage the library; fee earners
-- can read templates to generate documents on a matter.
-- =====================================================================

create table public.templates (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms (id) on delete cascade,
  name         text not null,
  description  text,
  file_name    text not null,
  storage_path text not null unique,
  mime_type    text,
  size_bytes   bigint,
  placeholders jsonb not null default '[]'::jsonb,
  is_starter   boolean not null default false,
  created_by   uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index templates_firm_idx on public.templates (firm_id) where deleted_at is null;
create index templates_starter_idx on public.templates (firm_id, is_starter) where deleted_at is null;

alter table public.templates enable row level security;
alter table public.templates force row level security;

create policy templates_select on public.templates for select to authenticated
  using (firm_id = app.firm_id() and deleted_at is null);

create policy templates_select_deleted on public.templates for select to authenticated
  using (firm_id = app.firm_id() and deleted_at is not null and app.is_partner());

create policy templates_insert on public.templates for insert to authenticated
  with check (firm_id = app.firm_id() and app.is_partner());

create policy templates_update on public.templates for update to authenticated
  using (firm_id = app.firm_id() and app.is_partner())
  with check (firm_id = app.firm_id() and app.is_partner());

create trigger templates_touch before update on public.templates
  for each row execute function public.touch_updated_at();

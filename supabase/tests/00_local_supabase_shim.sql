-- =====================================================================
-- Local-only stand-in for the parts of Supabase the schema depends on.
--
-- This is NOT applied to a Supabase project — it recreates auth.uid(),
-- auth.role(), the storage tables and the three Postgres roles so that
-- the policies and triggers can be exercised against a throwaway
-- Postgres. See scripts/test-db.sh.
-- =====================================================================

create extension if not exists "pgcrypto";

create schema if not exists auth;
create schema if not exists storage;

do $$ begin
  create role anon nologin noinherit;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin noinherit;
exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin noinherit bypassrls;
exception when duplicate_object then null; end $$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- The real implementations read the request's JWT claims, which
-- PostgREST sets per statement. Tests set the same GUCs directly.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

-- Everything up to the final segment, so a key of
-- <firm>/<matter>/<uuid>-<file> yields {firm, matter}.
create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1:array_length(parts, 1) - 1];
end;
$$;

grant all on all tables in schema storage to authenticated, service_role;

-- Supabase grants table privileges to these roles by default, so a table
-- created later is reachable and it is row-level security — not a missing
-- GRANT — that does the refusing. Mirror that here, or the tests would
-- pass for the wrong reason.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

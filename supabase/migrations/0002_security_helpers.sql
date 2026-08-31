-- =====================================================================
-- Security helpers.
--
-- These live in the private `app` schema and are SECURITY DEFINER so that
-- they can read public.users without re-entering the RLS policies that
-- call them (which would recurse). Every one of them returns nothing for
-- a disabled user, which is what makes "disable a user" take effect on
-- the very next statement rather than at session expiry.
-- =====================================================================

-- The caller's firm, or NULL if they have no active profile.
create or replace function app.firm_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select u.firm_id from public.users u
  where u.id = auth.uid() and u.status = 'active'
$$;

create or replace function app.user_role()
returns public.user_role
language sql stable security definer set search_path = public, pg_temp
as $$
  select u.role from public.users u
  where u.id = auth.uid() and u.status = 'active'
$$;

create or replace function app.is_active()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.status = 'active')
$$;

create or replace function app.is_partner()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.status = 'active' and u.role = 'partner')
$$;

-- True when the caller may read a matter and everything filed under it.
--   partner   -> every matter in the firm
--   associate -> assigned to them, or marked firm-wide
--   clerk     -> assigned to them only
create or replace function app.can_see_matter(p_matter_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.matters m
    join public.users u on u.id = auth.uid() and u.status = 'active'
    where m.id = p_matter_id
      and m.firm_id = u.firm_id
      and m.deleted_at is null
      and (
        u.role = 'partner'
        or m.assigned_to = u.id
        or (u.role = 'associate' and m.visibility = 'firm_wide')
      )
  )
$$;

-- True when the caller may add to a matter. A closed matter is read-only
-- for everyone except partners (Feature 3 acceptance test).
create or replace function app.can_write_matter(p_matter_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.matters m
    join public.users u on u.id = auth.uid() and u.status = 'active'
    where m.id = p_matter_id
      and m.firm_id = u.firm_id
      and m.deleted_at is null
      and (
        u.role = 'partner'
        or (
          m.status <> 'closed'
          and (m.assigned_to = u.id
               or (u.role = 'associate' and m.visibility = 'firm_wide'))
        )
      )
  )
$$;

-- Fee earners — partners and associates — are the roles that open files,
-- take on clients and keep the diary. Clerks read and file, they do not
-- create.
create or replace function app.is_fee_earner()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.status = 'active'
      and u.role in ('partner', 'associate'))
$$;

-- Fee notes and client money are invisible to clerks, everywhere.
create or replace function app.can_see_money()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.status = 'active'
      and u.role in ('partner', 'associate'))
$$;

-- True only for a caller that is not an end user: the service role, or a
-- direct psql session. The service-role key is server-side infrastructure
-- — signup, invitation redemption, seeding, the reminder job — and the
-- business-rule triggers let it through the role checks it could not
-- otherwise satisfy, since it has no auth.uid() to check a role against.
-- An anonymous request is not privileged here: every policy is granted to
-- `authenticated` only, so anon never reaches these triggers at all.
create or replace function app.is_privileged()
returns boolean
language sql stable set search_path = public, pg_temp
as $$
  select coalesce(auth.role(), 'service_role') not in ('authenticated', 'anon')
$$;

grant usage on schema app to authenticated, service_role;
grant execute on all functions in schema app to authenticated, service_role;

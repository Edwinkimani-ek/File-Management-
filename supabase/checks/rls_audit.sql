-- =====================================================================
-- Pre-pilot check: row-level security is on, and forced, everywhere.
--
-- ONE query on purpose. The Supabase SQL editor shows only the last
-- result set, so a file of separate SELECTs would quietly hide all but
-- the final check. Paste this in, run it, and read the whole verdict at
-- once.
--
--   ZERO ROWS = pass.
--
-- Any row is a problem to fix before the pilot firm touches this project.
-- Run it against staging and again against production.
-- =====================================================================

with problems as (

  -- 1. Any table in the public schema without RLS enabled.
  select 1 as seq, 'RLS NOT ENABLED' as problem, c.relname::text as object,
         'Every table carries firm_id and must enforce it' as detail
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

  union all

  -- 2. RLS enabled but not FORCED, so the table owner still bypasses it.
  select 2, 'RLS NOT FORCED', c.relname::text,
         'Owner-privileged connections would bypass the policies'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relrowsecurity and not c.relforcerowsecurity

  union all

  -- 3. RLS enabled with no policy at all — locks everyone out, and
  --    usually means a policy was forgotten rather than intended.
  select 3, 'NO POLICIES', c.relname::text,
         'RLS is on but nothing grants access; likely an omission'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)

  union all

  -- 4. Missing the firm_id column the tenancy rule is built on. `firms`
  --    is exempt: it *is* the tenant, keyed by id = app.firm_id().
  select 4, 'NO firm_id COLUMN', c.relname::text,
         'Tenancy cannot be enforced without it'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'firms'
    and not exists (
      select 1 from pg_attribute a
      where a.attrelid = c.oid and a.attname = 'firm_id'
        and a.attnum > 0 and not a.attisdropped)

  union all

  -- 5. A policy whose condition never narrows to a firm — directly via
  --    firm_id, or indirectly through a helper that does.
  select 5, 'POLICY NOT SCOPED TO A FIRM', (c.relname || '.' || p.polname)::text,
         coalesce(pg_get_expr(p.polqual, p.polrelid),
                  pg_get_expr(p.polwithcheck, p.polrelid), '(none)')
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and coalesce(pg_get_expr(p.polqual, p.polrelid), '')
          !~ 'firm_id|can_see_matter|can_write_matter'
    and coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
          !~ 'firm_id|can_see_matter|can_write_matter'

  union all

  -- 6. A public storage bucket. Both of ours must be private; documents
  --    are only ever served through short-lived signed URLs.
  select 6, 'PUBLIC BUCKET', id::text,
         'A leaked object URL would work without a signature'
  from storage.buckets where public

  union all

  -- 7. A security helper without a pinned search_path can be subverted
  --    by a caller-controlled one.
  select 7, 'HELPER SEARCH_PATH NOT PINNED', p.proname::text,
         'Add: set search_path = public, pg_temp'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proconfig is null

  union all

  -- 8. The helpers that read public.users must be SECURITY DEFINER or
  --    the policies calling them recurse. app.is_privileged() reads only
  --    session settings and is correctly left as INVOKER.
  select 8, 'HELPER SHOULD BE SECURITY DEFINER', p.proname::text,
         'Policies calling it would recurse under RLS'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and not p.prosecdef and p.proname <> 'is_privileged'

  union all

  -- 9. The activity log must stay append-only: no update or delete
  --    policy may exist on it.
  select 9, 'ACTIVITY LOG IS MUTABLE', p.polname::text,
         'The audit trail must be append-only'
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'activity_log'
    and p.polcmd in ('w', 'd')
)
select problem, object, detail
from problems
order by seq, object;

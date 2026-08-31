-- =====================================================================
-- Pre-pilot check: row-level security is on, and forced, everywhere.
--
-- Run this in the Supabase SQL editor against staging and again against
-- production. Every query below must return zero rows.
-- =====================================================================

-- 1. Any table in the public schema without RLS enabled.
select 'RLS NOT ENABLED' as problem, c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 2. Any table with RLS enabled but no policy at all — which locks
--    everyone out and usually means a policy was forgotten.
select 'NO POLICIES' as problem, c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

-- 3. Any table missing the firm_id column that the tenancy rule is built
--    on. `firms` is exempt: it *is* the tenant, and its policy is
--    id = app.firm_id(). Anything else appearing here is a mistake.
select 'NO firm_id COLUMN' as problem, c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname <> 'firms'
  and not exists (
    select 1 from pg_attribute a
    where a.attrelid = c.oid and a.attname = 'firm_id' and a.attnum > 0 and not a.attisdropped
  );

-- 4. Any policy whose condition never narrows to a firm — directly
--    through firm_id, or indirectly through one of the helpers that
--    does. Read each hit and satisfy yourself it is scoped some other
--    way before signing this off.
select 'POLICY WITHOUT firm_id' as problem,
       c.relname as table_name, p.polname as policy_name,
       pg_get_expr(p.polqual, p.polrelid) as using_expression,
       pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and coalesce(pg_get_expr(p.polqual, p.polrelid), '')
        !~ 'firm_id|can_see_matter|can_write_matter'
  and coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
        !~ 'firm_id|can_see_matter|can_write_matter';

-- 5. Storage buckets that are public. All of them must be private.
select 'PUBLIC BUCKET' as problem, id as bucket
from storage.buckets where public;

-- 6. Every helper must pin its search_path, or a caller-controlled one
--    can be used to swap out the tables it reads. The helpers that read
--    public.users must also be SECURITY DEFINER, or the policies calling
--    them recurse; app.is_privileged() reads only session settings and is
--    correctly left as INVOKER.
select 'HELPER SEARCH_PATH NOT PINNED' as problem, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.proconfig is null;

select 'HELPER SHOULD BE SECURITY DEFINER' as problem, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and not p.prosecdef
  and p.proname <> 'is_privileged';

-- --------------------------------------------------------------------
-- Informational: the full policy set, to read through once before pilot.
-- --------------------------------------------------------------------
select c.relname as table_name,
       p.polname as policy,
       case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                     when 'w' then 'UPDATE' when 'd' then 'DELETE'
                     else 'ALL' end as command,
       pg_get_expr(p.polqual, p.polrelid) as using_expression,
       pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, p.polname;

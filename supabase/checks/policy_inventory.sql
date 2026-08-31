-- =====================================================================
-- Informational: every policy in the public schema, to read through once
-- before the pilot. Not a pass/fail check — that is rls_audit.sql.
-- =====================================================================

select c.relname as table_name,
       p.polname as policy,
       case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                     when 'w' then 'UPDATE' when 'd' then 'DELETE'
                     else 'ALL' end as command,
       pg_get_expr(p.polqual, p.polrelid)      as using_expression,
       pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, p.polname;

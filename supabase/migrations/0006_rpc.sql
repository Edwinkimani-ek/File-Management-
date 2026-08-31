-- =====================================================================
-- Read-only helpers the application calls by name.
-- =====================================================================

-- Conflict check (Feature 2). Deliberately SECURITY DEFINER: a conflict
-- search has to cover the whole firm, including matters the caller is not
-- assigned to, otherwise it misses the conflict it exists to catch. It
-- still never crosses a firm boundary, and it returns only enough to name
-- the clash — not the contents of a matter the caller cannot open.
create or replace function public.conflict_check(
  p_query text,
  p_exclude_client_id uuid default null
)
returns table (
  kind           text,
  label          text,
  matter_id      uuid,
  file_reference text,
  matter_title   text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  with me as (
    select firm_id from public.users
    where id = auth.uid() and status = 'active'
  ), q as (
    select '%' || btrim(coalesce(p_query, '')) || '%' as pattern
  )
  select 'client'::text, c.full_name, null::uuid, null::text, null::text
  from public.clients c, me, q
  where c.firm_id = me.firm_id and c.deleted_at is null
    and length(btrim(coalesce(p_query, ''))) >= 3
    and c.full_name ilike q.pattern
    and (p_exclude_client_id is null or c.id <> p_exclude_client_id)

  union all

  select 'opposing_party'::text, m.opposing_party, m.id, m.file_reference, m.title
  from public.matters m, me, q
  where m.firm_id = me.firm_id and m.deleted_at is null
    and length(btrim(coalesce(p_query, ''))) >= 3
    and m.opposing_party is not null
    and m.opposing_party ilike q.pattern

  union all

  select 'opposing_advocates'::text, m.opposing_advocates, m.id, m.file_reference, m.title
  from public.matters m, me, q
  where m.firm_id = me.firm_id and m.deleted_at is null
    and length(btrim(coalesce(p_query, ''))) >= 3
    and m.opposing_advocates is not null
    and m.opposing_advocates ilike q.pattern

  limit 25;
$$;

revoke all on function public.conflict_check(text, uuid) from public, anon;
grant execute on function public.conflict_check(text, uuid) to authenticated;

-- Next file reference suggestion, e.g. KM/CIV/045/2026. The firm may
-- always override it, so this only has to be a sensible guess.
create or replace function public.suggest_file_reference(p_prefix text, p_year integer)
returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  with me as (
    select firm_id from public.users where id = auth.uid() and status = 'active'
  ), used as (
    select max((regexp_match(m.file_reference, '(\d+)/' || p_year::text || '$'))[1]::int) as n
    from public.matters m, me
    where m.firm_id = me.firm_id
      and m.file_reference ~ ('(\d+)/' || p_year::text || '$')
  )
  select p_prefix || '/' || lpad((coalesce((select n from used), 0) + 1)::text, 3, '0')
         || '/' || p_year::text;
$$;

revoke all on function public.suggest_file_reference(text, integer) from public, anon;
grant execute on function public.suggest_file_reference(text, integer) to authenticated;

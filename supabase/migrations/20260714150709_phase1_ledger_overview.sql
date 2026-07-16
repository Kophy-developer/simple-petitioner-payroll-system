create index if not exists ledger_rows_user_id_idx
  on public.ledger_rows (user_id);

create index if not exists ledger_rows_issue_id_idx
  on public.ledger_rows (issue_id);

create index if not exists ledger_rows_validity_pending_idx
  on public.ledger_rows (validity_pending)
  where validity_pending = true;

create or replace function public.ledger_overview(
  p_q text default null,
  p_issue_id uuid default null,
  p_pending_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  first_name text,
  last_name text,
  initials text,
  role public.user_role,
  issue_count bigint,
  pending_validity_count bigint,
  total_sigs bigint,
  total_estimated_pay numeric,
  total_pay numeric,
  total_upfront numeric,
  total_hold numeric,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $fn$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_q text := nullif(trim(coalesce(p_q, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  return query
  with visible as (
    select
      p.id as uid,
      p.first_name as fname,
      p.last_name as lname,
      p.initials as inits,
      p.role as urole,
      count(lr.id)::bigint as issue_count,
      count(lr.id) filter (where lr.validity_pending)::bigint as pending_validity_count,
      coalesce(sum(lr.sigs), 0)::bigint as total_sigs,
      coalesce(sum(lr.estimated_pay), 0)::numeric as total_estimated_pay,
      coalesce(sum(lr.total_pay), 0)::numeric as total_pay,
      coalesce(sum(lr.upfront), 0)::numeric as total_upfront,
      coalesce(sum(lr.hold), 0)::numeric as total_hold
    from public.profiles p
    join public.ledger_rows lr on lr.user_id = p.id
    where private.can_view_user(p.id)
      and (
        v_q is null
        or p.first_name ilike '%' || v_q || '%'
        or p.last_name ilike '%' || v_q || '%'
        or (p.first_name || ' ' || p.last_name) ilike '%' || v_q || '%'
        or p.initials ilike '%' || v_q || '%'
      )
      and (p_issue_id is null or lr.issue_id = p_issue_id)
    group by p.id, p.first_name, p.last_name, p.initials, p.role
    having (
      not coalesce(p_pending_only, false)
      or count(lr.id) filter (where lr.validity_pending) > 0
    )
  ),
  counted as (
    select count(*)::bigint as total_count from visible
  )
  select
    v.uid,
    v.fname,
    v.lname,
    v.inits,
    v.urole,
    v.issue_count,
    v.pending_validity_count,
    v.total_sigs,
    v.total_estimated_pay,
    v.total_pay,
    v.total_upfront,
    v.total_hold,
    c.total_count
  from visible v
  cross join counted c
  order by v.lname, v.fname
  limit v_limit
  offset v_offset;
end;
$fn$;

grant execute on function public.ledger_overview(text, uuid, boolean, integer, integer) to authenticated;

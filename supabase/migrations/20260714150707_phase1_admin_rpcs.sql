create or replace function public.update_pay_rate(
  p_issue_id uuid,
  p_pay_rate numeric
)
returns public.pay_rate_configs
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_issue public.issues%rowtype;
  v_row public.pay_rate_configs;
  r record;
begin
  if not private.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  select * into v_issue from public.issues where id = p_issue_id;
  if not found then
    raise exception 'Issue not found';
  end if;

  insert into public.pay_rate_configs (petition_id, issue_id, pay_rate)
  values (v_issue.petition_id, p_issue_id, p_pay_rate)
  on conflict (petition_id, issue_id) do update set
    pay_rate = excluded.pay_rate,
    updated_at = now()
  returning * into v_row;

  for r in
    select user_id from public.submission_records where issue_id = p_issue_id
  loop
    perform private.recalculate_ledger_row(r.user_id, p_issue_id);
  end loop;

  return v_row;
end;
$fn$;

create or replace function public.set_benchmark(p_pct numeric)
returns public.app_config
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.app_config;
  r record;
begin
  if not private.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'Benchmark must be between 0 and 100';
  end if;

  insert into public.app_config (key, value, updated_by)
  values ('benchmark_pct', to_jsonb(p_pct), auth.uid())
  on conflict (key) do update set
    value = excluded.value,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_row;

  for r in
    select sr.user_id, sr.issue_id
    from public.submission_records sr
    join public.issues i on i.id = sr.issue_id
    where i.pay_model = 'validity_standard'
  loop
    perform private.recalculate_ledger_row(r.user_id, r.issue_id);
  end loop;

  return v_row;
end;
$fn$;

create or replace function public.update_user_admin(
  p_user_id uuid,
  p_role public.user_role,
  p_hourly_wage numeric default null,
  p_wage_currency public.wage_currency default null,
  p_status public.user_status default 'active'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.profiles;
begin
  if not private.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  update public.profiles
  set
    role = p_role,
    hourly_wage = p_hourly_wage,
    wage_currency = p_wage_currency,
    status = p_status,
    updated_at = now()
  where id = p_user_id
  returning * into v_row;

  if not found then
    raise exception 'User not found';
  end if;

  return v_row;
end;
$fn$;

grant execute on function public.update_pay_rate(uuid, numeric) to authenticated;
grant execute on function public.set_benchmark(numeric) to authenticated;
grant execute on function public.update_user_admin(uuid, public.user_role, numeric, public.wage_currency, public.user_status) to authenticated;

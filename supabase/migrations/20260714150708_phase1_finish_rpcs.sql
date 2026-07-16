create or replace function public.apply_validity_upload(
  p_issue_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item jsonb;
  v_user_id uuid;
  v_dups integer;
  v_usable integer;
  v_valid integer;
  v_pct numeric;
  v_count integer := 0;
begin
  if not (
    private.is_admin_plus()
    or private.current_role() = 'validator'
  ) then
    raise exception 'Not authorized';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows must be a JSON array';
  end if;

  if not exists (select 1 from public.issues where id = p_issue_id) then
    raise exception 'Issue not found';
  end if;

  for v_item in select * from jsonb_array_elements(p_rows)
  loop
    v_user_id := nullif(v_item ->> 'user_id', '')::uuid;
    v_dups := coalesce((v_item ->> 'dups')::integer, 0);
    v_usable := coalesce((v_item ->> 'usable')::integer, 0);
    v_valid := coalesce((v_item ->> 'valid')::integer, 0);
    v_pct := coalesce((v_item ->> 'validity_pct')::numeric, 0);

    if v_user_id is null then
      continue;
    end if;

    insert into public.validity_records (
      issue_id, user_id, dups, usable, valid, validity_pct, entry_method, entered_by, entered_at
    )
    values (
      p_issue_id, v_user_id, v_dups, v_usable, v_valid, v_pct, 'upload', auth.uid(), now()
    )
    on conflict (user_id, issue_id) do update set
      dups = excluded.dups,
      usable = excluded.usable,
      valid = excluded.valid,
      validity_pct = excluded.validity_pct,
      entry_method = 'upload',
      entered_by = auth.uid(),
      entered_at = now(),
      updated_at = now();

    perform private.recalculate_ledger_row(v_user_id, p_issue_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

create or replace function public.update_issue(
  p_issue_id uuid,
  p_issue_number text default null,
  p_name text default null,
  p_state text default null,
  p_validated_by text default null,
  p_turn_in_date date default null,
  p_turn_in_number text default null,
  p_pay_model public.pay_model default null
)
returns public.issues
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.issues;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  update public.issues
  set
    issue_number = coalesce(nullif(trim(p_issue_number), ''), issue_number),
    name = coalesce(nullif(trim(p_name), ''), name),
    state = coalesce(nullif(upper(trim(p_state)), ''), state),
    validated_by = case
      when p_validated_by is null then validated_by
      else nullif(trim(p_validated_by), '')
    end,
    turn_in_date = case
      when p_turn_in_date is null then turn_in_date
      else p_turn_in_date
    end,
    turn_in_number = case
      when p_turn_in_number is null then turn_in_number
      else nullif(trim(p_turn_in_number), '')
    end,
    pay_model = coalesce(p_pay_model, pay_model),
    updated_at = now()
  where id = p_issue_id
  returning * into v_row;

  if not found then
    raise exception 'Issue not found';
  end if;

  return v_row;
end;
$fn$;

drop function if exists public.run_monthly_payroll(integer, integer);

create or replace function public.run_monthly_payroll(
  p_month integer,
  p_year integer,
  p_lock boolean default true
)
returns setof public.monthly_payroll_records
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status public.payroll_record_status;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  if exists (
    select 1 from public.monthly_payroll_records
    where month = p_month and year = p_year and status = 'locked'
  ) then
    raise exception 'Payroll period is locked';
  end if;

  v_status := case when p_lock then 'locked'::public.payroll_record_status else 'draft'::public.payroll_record_status end;

  return query
  with user_pay as (
    select
      lr.user_id,
      coalesce(sum(lr.total_pay), 0) as total_pay,
      coalesce(sum(lr.upfront), 0) as upfront_paid,
      coalesce(sum(lr.hold), 0) as hold_balance
    from public.ledger_rows lr
    group by lr.user_id
  ),
  user_exp as (
    select
      er.user_id,
      coalesce(sum(er.amount), 0) as total_expenses
    from public.expense_records er
    where extract(month from er.expense_date) = p_month
      and extract(year from er.expense_date) = p_year
    group by er.user_id
  ),
  merged as (
    select
      coalesce(up.user_id, ue.user_id) as user_id,
      coalesce(up.total_pay, 0) as total_pay,
      coalesce(ue.total_expenses, 0) as total_expenses,
      coalesce(up.upfront_paid, 0) as upfront_paid,
      coalesce(up.hold_balance, 0) as hold_balance
    from user_pay up
    full outer join user_exp ue on ue.user_id = up.user_id
  )
  insert into public.monthly_payroll_records (
    user_id, month, year, total_pay, total_expenses, net_payable,
    upfront_paid, hold_balance, generated_by, generated_on, status
  )
  select
    m.user_id,
    p_month,
    p_year,
    m.total_pay,
    m.total_expenses,
    private.round_money(m.total_pay - m.total_expenses),
    m.upfront_paid,
    m.hold_balance,
    auth.uid(),
    now(),
    v_status
  from merged m
  on conflict (user_id, month, year) do update set
    total_pay = excluded.total_pay,
    total_expenses = excluded.total_expenses,
    net_payable = excluded.net_payable,
    upfront_paid = excluded.upfront_paid,
    hold_balance = excluded.hold_balance,
    generated_by = excluded.generated_by,
    generated_on = excluded.generated_on,
    status = excluded.status,
    updated_at = now()
  where public.monthly_payroll_records.status <> 'locked'
  returning *;
end;
$fn$;

create or replace function public.lock_monthly_payroll(p_month integer, p_year integer)
returns setof public.monthly_payroll_records
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.monthly_payroll_records
    where month = p_month and year = p_year
  ) then
    raise exception 'No payroll draft for this period. Generate a draft first.';
  end if;

  if exists (
    select 1 from public.monthly_payroll_records
    where month = p_month and year = p_year and status = 'locked'
  ) then
    raise exception 'Payroll period is already locked';
  end if;

  return query
  update public.monthly_payroll_records
  set status = 'locked', updated_at = now()
  where month = p_month and year = p_year and status = 'draft'
  returning *;
end;
$fn$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_role text;
begin
  v_role := coalesce(
    new.raw_app_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'role',
    'petitioner'
  );

  insert into public.profiles (
    id,
    first_name,
    last_name,
    initials,
    email,
    role,
    status,
    wage_currency,
    hourly_wage,
    profile_tags
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(
      new.raw_user_meta_data ->> 'initials',
      upper(left(coalesce(new.raw_user_meta_data ->> 'first_name', new.email), 1)
        || left(coalesce(new.raw_user_meta_data ->> 'last_name', 'X'), 1))
    ),
    new.email,
    v_role::public.user_role,
    'active',
    nullif(
      coalesce(new.raw_app_meta_data ->> 'wage_currency', new.raw_user_meta_data ->> 'wage_currency'),
      ''
    )::public.wage_currency,
    nullif(
      coalesce(new.raw_app_meta_data ->> 'hourly_wage', new.raw_user_meta_data ->> 'hourly_wage'),
      ''
    )::numeric,
    coalesce(
      array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'profile_tags')),
      '{}'::text[]
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$fn$;

grant execute on function public.apply_validity_upload(uuid, jsonb) to authenticated;
grant execute on function public.update_issue(uuid, text, text, text, text, date, text, public.pay_model) to authenticated;
grant execute on function public.run_monthly_payroll(integer, integer, boolean) to authenticated;
grant execute on function public.lock_monthly_payroll(integer, integer) to authenticated;

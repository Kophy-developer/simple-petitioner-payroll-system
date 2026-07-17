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
  if not private.is_super_admin() then
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
  if not private.is_super_admin() then
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

create or replace function public.request_loan(p_amount numeric, p_note text default null)
returns public.loan_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_hold numeric(12, 2);
  v_row public.loan_requests;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role not in ('petitioner', 'canvasser', 'team_lead') then
    raise exception 'Not authorized';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  v_hold := private.user_hold_balance(auth.uid());

  insert into public.loan_requests (
    user_id,
    amount_requested,
    hold_balance_snapshot,
    note,
    status
  )
  values (
    auth.uid(),
    p_amount,
    v_hold,
    nullif(trim(p_note), ''),
    case
      when v_hold >= p_amount then 'pending'::public.loan_status
      else 'auto_rejected'::public.loan_status
    end
  )
  returning * into v_row;

  return v_row;
end;
$$;

drop policy if exists loan_requests_insert on public.loan_requests;
create policy loan_requests_insert on public.loan_requests
for insert to authenticated
with check (
  user_id = auth.uid()
  and private.current_role() in ('petitioner', 'canvasser', 'team_lead')
);

grant execute on function public.run_monthly_payroll(integer, integer, boolean) to authenticated;
grant execute on function public.lock_monthly_payroll(integer, integer) to authenticated;
grant execute on function public.request_loan(numeric, text) to authenticated;

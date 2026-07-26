DO $$
begin
  alter type public.expense_type add value 'gas';
exception
  when duplicate_object then null;
end $$;

create or replace function public.expense_balance(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total_pay numeric(12, 2);
  v_total_upfront numeric(12, 2);
  v_total_hold numeric(12, 2);
  v_total_expenses numeric(12, 2);
  v_year integer := extract(year from now())::integer;
begin
  if not private.can_view_user(p_user_id) then
    raise exception 'Not authorized';
  end if;

  select
    coalesce(sum(total_pay), 0),
    coalesce(sum(upfront), 0),
    coalesce(sum(hold), 0)
  into v_total_pay, v_total_upfront, v_total_hold
  from public.ledger_rows
  where user_id = p_user_id
    and extract(year from coalesce(recalculated_at, created_at)) = v_year;

  select coalesce(sum(amount), 0)
  into v_total_expenses
  from public.expense_records
  where user_id = p_user_id
    and extract(year from expense_date) = v_year
    and type <> 'upfront_draw';

  return jsonb_build_object(
    'total_pay', v_total_pay,
    'total_upfront', v_total_upfront,
    'total_hold', v_total_hold,
    'total_expenses', v_total_expenses,
    'live_balance', private.round_money(v_total_upfront - v_total_expenses)
  );
end;
$$;

create or replace function public.create_expense(
  p_type public.expense_type,
  p_amount numeric default null,
  p_expense_date date default current_date,
  p_end_date date default null,
  p_issue_id uuid default null,
  p_receipt_path text default null,
  p_user_id uuid default null,
  p_tolls_amount numeric default 0,
  p_car_active boolean default false
)
returns public.expense_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_amount numeric(12, 2) := p_amount;
  v_row public.expense_records;
begin
  if v_user <> auth.uid() and not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  if p_type = 'upfront_draw' then
    raise exception 'Upfront draw is a payout, not an expense. Record it under Payments.';
  end if;

  if p_type in ('hotel_travel', 'car_rental', 'housing') then
    if p_end_date is not null and p_end_date < p_expense_date then
      raise exception 'End date cannot be before start date';
    end if;
  elsif p_end_date is not null then
    raise exception 'End date only allowed for hotel/travel, car rental, and housing';
  end if;

  if v_amount is null then
    v_amount := public.suggested_expense_amount(p_type, p_issue_id);
  end if;

  if v_amount is null then
    raise exception 'Amount is required';
  end if;

  insert into public.expense_records (
    user_id, issue_id, type, amount, receipt_path, expense_date, end_date,
    tolls_amount, car_active
  )
  values (
    v_user, p_issue_id, p_type, v_amount, p_receipt_path, p_expense_date, p_end_date,
    coalesce(p_tolls_amount, 0),
    case when p_type = 'car_rental' then coalesce(p_car_active, false) else false end
  )
  returning * into v_row;

  return v_row;
end;
$$;

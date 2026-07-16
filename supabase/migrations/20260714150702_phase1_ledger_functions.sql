create or replace function private.round_money(value numeric)
returns numeric
language sql
immutable
as $$
  select round(value::numeric, 2);
$$;

create or replace function private.benchmark_pct()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((value #>> '{}')::numeric, 75)
  from public.app_config
  where key = 'benchmark_pct';
$$;

create or replace function private.user_hold_balance(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(hold), 0)
  from public.ledger_rows
  where user_id = p_user_id
    and hold is not null;
$$;

create or replace function private.recalculate_ledger_row(p_user_id uuid, p_issue_id uuid)
returns public.ledger_rows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue public.issues%rowtype;
  v_petition public.petitions%rowtype;
  v_submission public.submission_records%rowtype;
  v_validity public.validity_records%rowtype;
  v_pay_rate numeric(12, 4);
  v_benchmark numeric;
  v_estimated numeric(12, 2);
  v_payable integer;
  v_total numeric(12, 2);
  v_upfront numeric(12, 2);
  v_hold numeric(12, 2);
  v_pending boolean := true;
  v_row public.ledger_rows;
begin
  select * into v_issue from public.issues where id = p_issue_id;
  if not found then
    raise exception 'Issue not found';
  end if;

  select * into v_petition from public.petitions where id = v_issue.petition_id;
  select * into v_submission
  from public.submission_records
  where user_id = p_user_id and issue_id = p_issue_id;

  if not found then
    raise exception 'Submission not found for user/issue';
  end if;

  select * into v_validity
  from public.validity_records
  where user_id = p_user_id and issue_id = p_issue_id;

  select pay_rate into v_pay_rate
  from public.pay_rate_configs
  where petition_id = v_issue.petition_id and issue_id = p_issue_id;

  v_pay_rate := coalesce(v_pay_rate, 0);
  v_benchmark := private.benchmark_pct();
  v_estimated := private.round_money(v_submission.raw_signatures * v_petition.pay);

  if v_issue.pay_model = 'per_valid_sig' then
    if v_validity.id is not null then
      v_payable := v_validity.valid;
      v_total := private.round_money(v_payable * v_pay_rate);
      v_upfront := private.round_money(v_total * 0.85);
      v_hold := private.round_money(v_total * 0.15);
      v_pending := false;
    else
      v_payable := null;
      v_total := null;
      v_upfront := null;
      v_hold := null;
      v_pending := true;
    end if;
  else
    if v_validity.id is not null then
      if v_validity.validity_pct >= v_benchmark then
        v_payable := v_submission.raw_signatures;
      else
        v_payable := round(
          v_submission.raw_signatures * (1 - ((v_benchmark - v_validity.validity_pct) / 100.0))
        )::integer;
      end if;
      v_total := private.round_money(v_petition.pay * v_payable * v_pay_rate);
      v_upfront := private.round_money(v_total * 0.85);
      v_hold := private.round_money(v_total * 0.15);
      v_pending := false;
    else
      v_payable := null;
      v_total := null;
      v_upfront := null;
      v_hold := null;
      v_pending := true;
    end if;
  end if;

  insert into public.ledger_rows (
    user_id,
    issue_id,
    sigs,
    pay,
    estimated_pay,
    dups,
    usable,
    valid,
    validity_pct,
    pay_rate,
    payable,
    total_pay,
    upfront,
    hold,
    pay_model,
    validity_pending,
    recalculated_at
  )
  values (
    p_user_id,
    p_issue_id,
    v_submission.raw_signatures,
    v_petition.pay,
    v_estimated,
    case when v_pending then null else v_validity.dups end,
    case when v_pending then null else v_validity.usable end,
    case when v_pending then null else v_validity.valid end,
    case when v_pending then null else v_validity.validity_pct end,
    v_pay_rate,
    v_payable,
    v_total,
    v_upfront,
    v_hold,
    v_issue.pay_model,
    v_pending,
    case when v_pending then null else now() end
  )
  on conflict (user_id, issue_id) do update set
    sigs = excluded.sigs,
    pay = excluded.pay,
    estimated_pay = excluded.estimated_pay,
    dups = excluded.dups,
    usable = excluded.usable,
    valid = excluded.valid,
    validity_pct = excluded.validity_pct,
    pay_rate = excluded.pay_rate,
    payable = excluded.payable,
    total_pay = excluded.total_pay,
    upfront = excluded.upfront,
    hold = excluded.hold,
    pay_model = excluded.pay_model,
    validity_pending = excluded.validity_pending,
    recalculated_at = excluded.recalculated_at,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.preview_submission_edit(
  p_submission_id uuid,
  p_raw_signatures integer,
  p_page_numbers integer default null,
  p_pooled_signatures integer default null,
  p_pooled_pages integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.submission_records%rowtype;
  v_issue public.issues%rowtype;
  v_petition public.petitions%rowtype;
  v_validity public.validity_records%rowtype;
  v_pay_rate numeric(12, 4);
  v_benchmark numeric;
  v_payable integer;
  v_total numeric(12, 2);
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  select * into v_sub from public.submission_records where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;

  select * into v_issue from public.issues where id = v_sub.issue_id;
  select * into v_petition from public.petitions where id = v_issue.petition_id;
  select * into v_validity from public.validity_records
  where user_id = v_sub.user_id and issue_id = v_sub.issue_id;
  select pay_rate into v_pay_rate from public.pay_rate_configs
  where petition_id = v_issue.petition_id and issue_id = v_sub.issue_id;
  v_pay_rate := coalesce(v_pay_rate, 0);
  v_benchmark := private.benchmark_pct();

  if v_issue.pay_model = 'per_valid_sig' then
    if v_validity.id is null then
      return jsonb_build_object(
        'estimated_pay', private.round_money(p_raw_signatures * v_petition.pay),
        'payable', null,
        'total_pay', null,
        'upfront', null,
        'hold', null,
        'validity_pending', true
      );
    end if;
    v_payable := v_validity.valid;
    v_total := private.round_money(v_payable * v_pay_rate);
  else
    if v_validity.id is null then
      return jsonb_build_object(
        'estimated_pay', private.round_money(p_raw_signatures * v_petition.pay),
        'payable', null,
        'total_pay', null,
        'upfront', null,
        'hold', null,
        'validity_pending', true
      );
    end if;
    if v_validity.validity_pct >= v_benchmark then
      v_payable := p_raw_signatures;
    else
      v_payable := round(
        p_raw_signatures * (1 - ((v_benchmark - v_validity.validity_pct) / 100.0))
      )::integer;
    end if;
    v_total := private.round_money(v_petition.pay * v_payable * v_pay_rate);
  end if;

  return jsonb_build_object(
    'estimated_pay', private.round_money(p_raw_signatures * v_petition.pay),
    'payable', v_payable,
    'total_pay', v_total,
    'upfront', private.round_money(v_total * 0.85),
    'hold', private.round_money(v_total * 0.15),
    'validity_pending', false,
    'from_raw_signatures', v_sub.raw_signatures,
    'to_raw_signatures', p_raw_signatures,
    'page_numbers', coalesce(p_page_numbers, v_sub.page_numbers),
    'pooled_signatures', coalesce(p_pooled_signatures, v_sub.pooled_signatures),
    'pooled_pages', coalesce(p_pooled_pages, v_sub.pooled_pages)
  );
end;
$$;

create or replace function public.confirm_submission_edit(
  p_submission_id uuid,
  p_raw_signatures integer,
  p_page_numbers integer default null,
  p_pooled_signatures integer default null,
  p_pooled_pages integer default null
)
returns public.ledger_rows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.submission_records%rowtype;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  update public.submission_records
  set
    raw_signatures = p_raw_signatures,
    page_numbers = coalesce(p_page_numbers, page_numbers),
    pooled_signatures = coalesce(p_pooled_signatures, pooled_signatures),
    pooled_pages = coalesce(p_pooled_pages, pooled_pages),
    last_edited_by = auth.uid(),
    last_edited_at = now()
  where id = p_submission_id
  returning * into v_sub;

  if not found then
    raise exception 'Submission not found';
  end if;

  return private.recalculate_ledger_row(v_sub.user_id, v_sub.issue_id);
end;
$$;

create or replace function public.upsert_validity_manual(
  p_issue_id uuid,
  p_user_id uuid,
  p_dups integer,
  p_usable integer,
  p_valid integer,
  p_validity_pct numeric
)
returns public.ledger_rows
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    private.is_admin_plus()
    or private.current_role() = 'validator'
  ) then
    raise exception 'Not authorized';
  end if;

  insert into public.validity_records (
    issue_id, user_id, dups, usable, valid, validity_pct, entry_method, entered_by, entered_at
  )
  values (
    p_issue_id, p_user_id, p_dups, p_usable, p_valid, p_validity_pct, 'manual', auth.uid(), now()
  )
  on conflict (user_id, issue_id) do update set
    dups = excluded.dups,
    usable = excluded.usable,
    valid = excluded.valid,
    validity_pct = excluded.validity_pct,
    entry_method = 'manual',
    entered_by = auth.uid(),
    entered_at = now(),
    updated_at = now();

  return private.recalculate_ledger_row(p_user_id, p_issue_id);
end;
$$;

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
  if v_role is null or v_role not in ('petitioner', 'canvasser') then
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

create or replace function public.review_loan(
  p_loan_id uuid,
  p_approve boolean
)
returns public.loan_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.loan_requests;
begin
  if not private.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  update public.loan_requests
  set
    status = case when p_approve then 'approved'::public.loan_status else 'rejected'::public.loan_status end,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_loan_id
    and status = 'pending'
  returning * into v_row;

  if not found then
    raise exception 'Pending loan not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.suggested_expense_amount(
  p_type public.expense_type,
  p_issue_id uuid default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_amount numeric(12, 2);
begin
  if p_type = 'car_rental' then
    select rate into v_amount
    from public.car_rental_configs
    where config_type = 'per_issue' and issue_id = p_issue_id;

    if v_amount is null then
      select rate into v_amount
      from public.car_rental_configs
      where config_type = 'standard'
      limit 1;
    end if;
  elsif p_type = 'housing' then
    select rate into v_amount
    from public.housing_configs
    where config_type = 'per_issue' and issue_id = p_issue_id;

    if v_amount is null then
      select rate into v_amount
      from public.housing_configs
      where config_type = 'standard'
      limit 1;
    end if;
  end if;

  return v_amount;
end;
$$;

create or replace function public.create_expense(
  p_type public.expense_type,
  p_amount numeric default null,
  p_expense_date date default current_date,
  p_end_date date default null,
  p_issue_id uuid default null,
  p_receipt_path text default null,
  p_user_id uuid default null
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
    user_id, issue_id, type, amount, receipt_path, expense_date, end_date
  )
  values (
    v_user, p_issue_id, p_type, v_amount, p_receipt_path, p_expense_date, p_end_date
  )
  returning * into v_row;

  return v_row;
end;
$$;

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
  where user_id = p_user_id;

  select coalesce(sum(amount), 0)
  into v_total_expenses
  from public.expense_records
  where user_id = p_user_id
    and date_trunc('month', expense_date::timestamp) = date_trunc('month', now());

  return jsonb_build_object(
    'total_pay', v_total_pay,
    'total_upfront', v_total_upfront,
    'total_hold', v_total_hold,
    'total_expenses', v_total_expenses,
    'live_balance', private.round_money(v_total_upfront - v_total_expenses)
  );
end;
$$;

create or replace function public.run_monthly_payroll(p_month integer, p_year integer)
returns setof public.monthly_payroll_records
language plpgsql
security definer
set search_path = public
as $$
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
    'locked'
  from merged m
  on conflict (user_id, month, year) do update set
    total_pay = excluded.total_pay,
    total_expenses = excluded.total_expenses,
    net_payable = excluded.net_payable,
    upfront_paid = excluded.upfront_paid,
    hold_balance = excluded.hold_balance,
    generated_by = excluded.generated_by,
    generated_on = excluded.generated_on,
    status = 'locked',
    updated_at = now()
  where public.monthly_payroll_records.status <> 'locked'
  returning *;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
      upper(left(coalesce(new.raw_user_meta_data ->> 'first_name', new.email), 1))
    ),
    new.email,
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'petitioner'),
    'active',
    nullif(new.raw_app_meta_data ->> 'wage_currency', '')::public.wage_currency,
    nullif(new.raw_app_meta_data ->> 'hourly_wage', '')::numeric,
    coalesce(
      array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'profile_tags')),
      '{}'::text[]
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant execute on function public.preview_submission_edit(uuid, integer, integer, integer, integer) to authenticated;
grant execute on function public.confirm_submission_edit(uuid, integer, integer, integer, integer) to authenticated;
grant execute on function public.upsert_validity_manual(uuid, uuid, integer, integer, integer, numeric) to authenticated;
grant execute on function public.request_loan(numeric, text) to authenticated;
grant execute on function public.review_loan(uuid, boolean) to authenticated;
grant execute on function public.suggested_expense_amount(public.expense_type, uuid) to authenticated;
grant execute on function public.create_expense(public.expense_type, numeric, date, date, uuid, text, uuid) to authenticated;
grant execute on function public.expense_balance(uuid) to authenticated;
grant execute on function public.run_monthly_payroll(integer, integer) to authenticated;

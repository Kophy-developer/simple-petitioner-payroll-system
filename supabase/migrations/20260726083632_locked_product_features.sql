alter table public.profiles
  add column if not exists invite_sent_at timestamptz,
  add column if not exists is_lotus boolean not null default false;

update public.profiles
set employee_id = 'BAP-' || employee_id
where employee_id ~ '^[0-9]{5}$'
  and employee_id not like 'BAP-%';

update public.profiles
set employee_id = case
  when lower(first_name) = 'charles' and lower(last_name) = 'eden' then 'BAP-01'
  when lower(first_name) = 'kabir' and lower(last_name) = 'wolf' then 'BAP-02'
  when lower(first_name) = 'tristan' and lower(last_name) = 'miller' then 'BAP-03'
  else employee_id
end
where (
  (lower(first_name) = 'charles' and lower(last_name) = 'eden')
  or (lower(first_name) = 'kabir' and lower(last_name) = 'wolf')
  or (lower(first_name) = 'tristan' and lower(last_name) = 'miller')
);

do $$
declare
  v_max integer;
begin
  select max(
    case
      when employee_id ~ '^BAP-[0-9]{5}$' then substring(employee_id from 5)::integer
      when employee_id ~ '^[0-9]{5}$' then employee_id::integer
      else null
    end
  )
  into v_max
  from public.profiles;

  if v_max is null then
    perform setval('public.employee_id_seq', 10001, false);
  else
    perform setval('public.employee_id_seq', greatest(v_max, 10001), true);
  end if;
end $$;

create or replace function public.next_employee_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  v_n := nextval('public.employee_id_seq')::integer;
  if v_n > 99999 then
    raise exception 'Employee ID space exhausted';
  end if;
  return 'BAP-' || lpad(v_n::text, 5, '0');
end;
$$;

create or replace function public.allocate_employee_id(
  p_first_name text,
  p_last_name text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text := lower(trim(coalesce(p_first_name, '')));
  v_last text := lower(trim(coalesce(p_last_name, '')));
  v_special text;
begin
  if v_first = 'charles' and v_last = 'eden' then
    v_special := 'BAP-01';
  elsif v_first = 'kabir' and v_last = 'wolf' then
    v_special := 'BAP-02';
  elsif v_first = 'tristan' and v_last = 'miller' then
    v_special := 'BAP-03';
  end if;

  if v_special is not null then
    if exists (select 1 from public.profiles where employee_id = v_special) then
      return public.next_employee_id();
    end if;
    return v_special;
  end if;

  return public.next_employee_id();
end;
$$;

grant execute on function public.next_employee_id() to service_role;
grant execute on function public.allocate_employee_id(text, text) to service_role;

do $$
begin
  create type public.housing_share_kind as enum ('full', 'half', 'skip');
exception
  when duplicate_object then null;
end $$;

alter table public.lodging_properties
  add column if not exists full_rate numeric(12, 2),
  add column if not exists half_rate numeric(12, 2);

update public.lodging_properties
set full_rate = coalesce(full_rate, room_rate, daily_total),
    half_rate = coalesce(half_rate, round(coalesce(room_rate, daily_total, 0) / 2, 2))
where full_rate is null or half_rate is null;

alter table public.lodging_occupancies
  add column if not exists share_kind public.housing_share_kind not null default 'full',
  add column if not exists checkout_requested_at timestamptz,
  add column if not exists checkout_approved_at timestamptz,
  add column if not exists last_accrued_on date;

create table if not exists public.rental_car_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  pickup_at date not null,
  return_at date,
  agreement_number text,
  pickup_location text,
  dropoff_location text,
  one_way_fee numeric(12, 2) not null default 0 check (one_way_fee >= 0),
  monthly_accrual_amount numeric(12, 2) not null default 1146,
  active boolean not null default true,
  last_accrued_on date,
  trued_up_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rental_car_assignments_active_idx
  on public.rental_car_assignments (user_id)
  where active = true and return_at is null;

create table if not exists public.brex_transactions (
  id uuid primary key default gen_random_uuid(),
  brex_id text not null unique,
  cardholder_name text,
  amount numeric(12, 2) not null,
  occurred_at timestamptz,
  merchant_name text,
  description text,
  matched_user_id uuid references public.profiles (id) on delete set null,
  reimbursement_requested boolean not null default false,
  reimbursement_requested_by uuid references public.profiles (id) on delete set null,
  reimbursement_requested_at timestamptz,
  reimbursement_status text not null default 'none'
    check (reimbursement_status in ('none', 'pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  expense_id uuid references public.expense_records (id) on delete set null,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brex_transactions_user_idx on public.brex_transactions (matched_user_id);

alter table public.rental_car_assignments enable row level security;
alter table public.brex_transactions enable row level security;

drop policy if exists rental_cars_select on public.rental_car_assignments;
create policy rental_cars_select on public.rental_car_assignments
for select to authenticated
using (private.can_view_user(user_id) or private.is_admin_plus());

drop policy if exists rental_cars_admin on public.rental_car_assignments;
create policy rental_cars_admin on public.rental_car_assignments
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

drop policy if exists brex_select on public.brex_transactions;
create policy brex_select on public.brex_transactions
for select to authenticated
using (
  private.is_admin_plus()
  or matched_user_id = auth.uid()
);

drop policy if exists brex_update_self on public.brex_transactions;
create policy brex_update_self on public.brex_transactions
for update to authenticated
using (matched_user_id = auth.uid() or private.is_admin_plus())
with check (matched_user_id = auth.uid() or private.is_admin_plus());

drop policy if exists brex_admin_write on public.brex_transactions;
create policy brex_admin_write on public.brex_transactions
for insert to authenticated
with check (private.is_admin_plus());

grant select on public.rental_car_assignments to authenticated;
grant insert, update, delete on public.rental_car_assignments to authenticated;
grant select, update on public.brex_transactions to authenticated;
grant insert on public.brex_transactions to authenticated;

create or replace function public.expense_balance(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total_pay numeric(12, 2) := 0;
  v_total_upfront numeric(12, 2) := 0;
  v_total_hold numeric(12, 2) := 0;
  v_total_expenses numeric(12, 2) := 0;
  v_total_paid numeric(12, 2) := 0;
  v_year integer := extract(year from now())::integer;
  v_lines_pay numeric(12, 2) := 0;
  v_lines_upfront numeric(12, 2) := 0;
  v_lines_hold numeric(12, 2) := 0;
  v_rows_pay numeric(12, 2) := 0;
  v_rows_upfront numeric(12, 2) := 0;
  v_rows_hold numeric(12, 2) := 0;
begin
  if not private.can_view_user(p_user_id) then
    raise exception 'Not authorized';
  end if;

  select
    coalesce(sum(ll.total_pay), 0),
    coalesce(sum(ll.upfront), 0),
    coalesce(sum(ll.hold), 0)
  into v_lines_pay, v_lines_upfront, v_lines_hold
  from public.ledger_lines ll
  join public.turn_ins t on t.id = ll.turn_in_id
  where ll.user_id = p_user_id
    and extract(year from coalesce(t.turn_in_date, ll.created_at::date)) = v_year;

  select
    coalesce(sum(total_pay), 0),
    coalesce(sum(upfront), 0),
    coalesce(sum(hold), 0)
  into v_rows_pay, v_rows_upfront, v_rows_hold
  from public.ledger_rows
  where user_id = p_user_id
    and extract(year from coalesce(recalculated_at, created_at)) = v_year;

  v_total_pay := v_lines_pay + v_rows_pay;
  v_total_upfront := v_lines_upfront + v_rows_upfront;
  v_total_hold := v_lines_hold + v_rows_hold;

  select coalesce(sum(amount + coalesce(tolls_amount, 0)), 0)
  into v_total_expenses
  from public.expense_records
  where user_id = p_user_id
    and extract(year from expense_date) = v_year
    and type <> 'upfront_draw';

  select coalesce(sum(amount), 0)
  into v_total_paid
  from public.payment_events
  where user_id = p_user_id
    and extract(year from event_date) = v_year
    and bucket <> 'reimburse'
    and event_type in ('onpay', 'cashapp', 'full_pay', 'paid', 'advances', 'flight_advance');

  return jsonb_build_object(
    'total_pay', coalesce(v_total_pay, 0),
    'total_upfront', coalesce(v_total_upfront, 0),
    'total_hold', coalesce(v_total_hold, 0),
    'total_expenses', coalesce(v_total_expenses, 0),
    'total_paid', coalesce(v_total_paid, 0),
    'live_balance', private.round_money(
      coalesce(v_total_upfront, 0)
      - coalesce(v_total_expenses, 0)
      - coalesce(v_total_paid, 0)
      + coalesce((
        select sum(amount) from public.payment_events
        where user_id = p_user_id
          and extract(year from event_date) = v_year
          and bucket = 'reimburse'
      ), 0)
    )
  );
end;
$$;

create or replace function public.create_payment_event(
  p_user_id uuid,
  p_bucket public.payment_bucket,
  p_event_type public.payment_event_type,
  p_amount numeric,
  p_notes text default null,
  p_receipt_path text default null,
  p_event_date date default current_date,
  p_funds_hit_at date default null,
  p_loan_id uuid default null
)
returns public.payment_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.payment_events;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  insert into public.payment_events (
    user_id, bucket, event_type, amount, notes, receipt_path,
    event_date, paid_at, funds_hit_at, loan_id, created_by
  ) values (
    p_user_id, p_bucket, p_event_type, coalesce(p_amount, 0),
    nullif(trim(p_notes), ''), p_receipt_path, coalesce(p_event_date, current_date),
    now(), p_funds_hit_at, p_loan_id, auth.uid()
  )
  returning * into v_row;

  return v_row;
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
    'pending'::public.loan_status
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.rental_car_guide_total(p_days integer)
returns numeric
language plpgsql
immutable
as $$
declare
  v_days integer := greatest(0, coalesce(p_days, 0));
  v_months integer;
  v_weeks integer;
  v_rem integer;
begin
  v_months := v_days / 30;
  v_rem := v_days % 30;
  v_weeks := v_rem / 7;
  v_rem := v_rem % 7;
  return private.round_money(v_months * 1146 + v_weeks * 309 + v_rem * 50);
end;
$$;

create or replace function public.assign_rental_car(
  p_user_id uuid,
  p_pickup_at date,
  p_return_at date default null,
  p_agreement_number text default null,
  p_pickup_location text default null,
  p_dropoff_location text default null,
  p_one_way_fee numeric default 0
)
returns public.rental_car_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rental_car_assignments;
  v_fee numeric(12, 2) := greatest(0, coalesce(p_one_way_fee, 0));
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  if v_fee > 0 and not private.is_admin_plus() then
    raise exception 'One-way fee is admin only';
  end if;

  insert into public.rental_car_assignments (
    user_id, pickup_at, return_at, agreement_number, pickup_location,
    dropoff_location, one_way_fee, created_by, last_accrued_on
  ) values (
    p_user_id, p_pickup_at, p_return_at,
    nullif(trim(p_agreement_number), ''),
    nullif(trim(p_pickup_location), ''),
    nullif(trim(p_dropoff_location), ''),
    v_fee, auth.uid(), p_pickup_at - 1
  )
  returning * into v_row;

  if v_fee > 0 then
    insert into public.expense_records (
      user_id, type, amount, expense_date, end_date, car_active
    ) values (
      p_user_id, 'car_rental', v_fee, p_pickup_at, p_pickup_at, false
    );
  end if;

  return v_row;
end;
$$;

create or replace function public.accrue_rental_cars(p_as_of date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
  v_from date;
  v_to date;
  v_days integer;
begin
  for r in
    select * from public.rental_car_assignments
    where active = true and return_at is null
  loop
    v_from := coalesce(r.last_accrued_on + 1, r.pickup_at);
    v_to := least(p_as_of, coalesce(r.return_at, p_as_of));
    if v_to < v_from then
      continue;
    end if;
    v_days := (v_to - v_from) + 1;
    if v_days <= 0 then
      continue;
    end if;

    insert into public.expense_records (
      user_id, type, amount, expense_date, end_date, car_active
    ) values (
      r.user_id,
      'car_rental',
      private.round_money((v_days::numeric / 30.0) * coalesce(r.monthly_accrual_amount, 1146)),
      v_to,
      v_to,
      true
    );

    update public.rental_car_assignments
    set last_accrued_on = v_to, updated_at = now()
    where id = r.id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.return_rental_car(
  p_assignment_id uuid,
  p_return_at date default current_date,
  p_one_way_fee numeric default null
)
returns public.rental_car_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rental_car_assignments;
  v_days integer;
  v_total numeric(12, 2);
  v_prior numeric(12, 2);
  v_delta numeric(12, 2);
  v_fee numeric(12, 2);
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  select * into v_row from public.rental_car_assignments where id = p_assignment_id;
  if not found then
    raise exception 'Rental assignment not found';
  end if;

  v_days := greatest(0, (p_return_at - v_row.pickup_at));
  v_total := public.rental_car_guide_total(v_days);
  v_fee := coalesce(p_one_way_fee, v_row.one_way_fee, 0);

  select coalesce(sum(amount), 0) into v_prior
  from public.expense_records
  where user_id = v_row.user_id
    and type = 'car_rental'
    and expense_date >= v_row.pickup_at
    and expense_date <= p_return_at
    and car_active = true;

  v_delta := private.round_money(v_total + v_fee - v_prior - coalesce(v_row.one_way_fee, 0));
  if p_one_way_fee is not null and p_one_way_fee <> v_row.one_way_fee then
    v_delta := private.round_money(v_total + v_fee - v_prior - coalesce(v_row.one_way_fee, 0));
    if v_fee > coalesce(v_row.one_way_fee, 0) then
      insert into public.expense_records (user_id, type, amount, expense_date, end_date, car_active)
      values (v_row.user_id, 'car_rental', private.round_money(v_fee - coalesce(v_row.one_way_fee, 0)), p_return_at, p_return_at, false);
    end if;
  end if;

  if v_delta <> 0 then
    insert into public.expense_records (user_id, type, amount, expense_date, end_date, car_active)
    values (v_row.user_id, 'car_rental', v_delta, p_return_at, p_return_at, false);
  end if;

  update public.rental_car_assignments
  set
    return_at = p_return_at,
    active = false,
    one_way_fee = v_fee,
    trued_up_at = now(),
    updated_at = now()
  where id = p_assignment_id
  returning * into v_row;

  update public.expense_records
  set car_active = false, updated_at = now()
  where user_id = v_row.user_id and type = 'car_rental' and car_active = true;

  return v_row;
end;
$$;

create or replace function public.bulk_assign_housing(
  p_property_id uuid,
  p_check_in date,
  p_full_rate numeric,
  p_half_rate numeric,
  p_assignments jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prop public.lodging_properties;
  v_item jsonb;
  v_user uuid;
  v_share public.housing_share_kind;
  v_daily numeric(12, 2);
  v_count integer := 0;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  select * into v_prop from public.lodging_properties where id = p_property_id;
  if not found then
    raise exception 'Property not found';
  end if;

  update public.lodging_properties
  set
    full_rate = p_full_rate,
    half_rate = p_half_rate,
    room_rate = p_full_rate,
    updated_at = now()
  where id = p_property_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb))
  loop
    v_user := (v_item ->> 'user_id')::uuid;
    v_share := coalesce((v_item ->> 'share_kind')::public.housing_share_kind, 'skip');
    if v_share = 'skip' or v_user is null then
      continue;
    end if;

    v_daily := case when v_share = 'half' then p_half_rate else p_full_rate end;

    insert into public.lodging_occupancies (
      property_id, user_id, room_number, occupants_in_room,
      check_in_at, daily_amount, share_kind, last_accrued_on
    ) values (
      p_property_id, v_user, coalesce(v_item ->> 'room_number', ''),
      1, p_check_in::timestamptz, v_daily, v_share, p_check_in - 1
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.accrue_housing_nightly(p_as_of date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
  v_from date;
  v_to date;
  v_day date;
begin
  for r in
    select o.*, p.full_rate, p.half_rate
    from public.lodging_occupancies o
    join public.lodging_properties p on p.id = o.property_id
    where o.check_out_at is null
      and o.check_out_date is null
      and o.share_kind <> 'skip'
  loop
    v_from := coalesce(r.last_accrued_on + 1, r.check_in_at::date);
    v_to := p_as_of;
    if r.checkout_approved_at is not null then
      v_to := least(v_to, (r.checkout_approved_at at time zone 'America/Denver')::date - 1);
    end if;
    if v_to < v_from then
      continue;
    end if;

    v_day := v_from;
    while v_day <= v_to loop
      insert into public.expense_records (
        user_id, type, amount, expense_date, end_date, lodging_occupancy_id
      ) values (
        r.user_id,
        'housing',
        coalesce(
          r.daily_amount,
          case when r.share_kind = 'half' then r.half_rate else r.full_rate end,
          0
        ),
        v_day,
        v_day,
        r.id
      );
      v_day := v_day + 1;
      v_count := v_count + 1;
    end loop;

    update public.lodging_occupancies
    set last_accrued_on = v_to, updated_at = now()
    where id = r.id;
  end loop;

  return v_count;
end;
$$;

create or replace function public.request_housing_checkout(p_occupancy_id uuid)
returns public.lodging_occupancies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.lodging_occupancies;
begin
  select * into v_row from public.lodging_occupancies where id = p_occupancy_id;
  if not found then
    raise exception 'Stay not found';
  end if;
  if v_row.user_id <> auth.uid() and not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;
  if v_row.check_out_at is not null or v_row.check_out_date is not null then
    raise exception 'Already checked out';
  end if;

  update public.lodging_occupancies
  set checkout_requested_at = now(), updated_at = now()
  where id = p_occupancy_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.approve_housing_checkout(
  p_occupancy_id uuid,
  p_checkout_date date default current_date
)
returns public.lodging_occupancies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.lodging_occupancies;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  update public.lodging_occupancies
  set
    checkout_approved_at = now(),
    check_out_date = p_checkout_date,
    check_out_at = (p_checkout_date::text || ' 12:00:00')::timestamptz,
    updated_at = now()
  where id = p_occupancy_id
    and check_out_at is null
  returning * into v_row;

  if not found then
    raise exception 'Open stay not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.update_housing_rates(
  p_property_id uuid,
  p_full_rate numeric,
  p_half_rate numeric
)
returns public.lodging_properties
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.lodging_properties;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  update public.lodging_properties
  set
    full_rate = p_full_rate,
    half_rate = p_half_rate,
    room_rate = p_full_rate,
    updated_at = now()
  where id = p_property_id
  returning * into v_row;

  update public.lodging_occupancies
  set
    daily_amount = case when share_kind = 'half' then p_half_rate else p_full_rate end,
    updated_at = now()
  where property_id = p_property_id
    and check_out_at is null
    and check_out_date is null
    and share_kind <> 'skip';

  return v_row;
end;
$$;

create or replace function public.mark_brex_for_reimbursement(p_brex_id uuid)
returns public.brex_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.brex_transactions;
begin
  select * into v_row from public.brex_transactions where id = p_brex_id;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_row.matched_user_id <> auth.uid() and not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  update public.brex_transactions
  set
    reimbursement_requested = true,
    reimbursement_requested_by = auth.uid(),
    reimbursement_requested_at = now(),
    reimbursement_status = 'pending',
    updated_at = now()
  where id = p_brex_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.review_brex_reimbursement(
  p_brex_id uuid,
  p_approve boolean
)
returns public.brex_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.brex_transactions;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  select * into v_row from public.brex_transactions where id = p_brex_id;
  if not found then
    raise exception 'Transaction not found';
  end if;

  if not p_approve then
    update public.brex_transactions
    set
      reimbursement_status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    where id = p_brex_id
    returning * into v_row;
    return v_row;
  end if;

  if v_row.matched_user_id is null then
    raise exception 'Transaction is not matched to a user';
  end if;

  insert into public.payment_events (
    user_id, bucket, event_type, amount, notes,
    event_date, paid_at, created_by
  ) values (
    v_row.matched_user_id,
    'reimburse',
    'other',
    abs(v_row.amount),
    coalesce('Brex reimbursement: ' || v_row.merchant_name, 'Brex reimbursement'),
    coalesce(v_row.occurred_at::date, current_date),
    now(),
    auth.uid()
  );

  update public.brex_transactions
  set
    reimbursement_status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_brex_id
  returning * into v_row;

  return v_row;
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

  if p_type in ('hotel_travel', 'car_rental', 'housing') and not private.is_admin_plus() then
    raise exception 'Housing and rental cars are assigned in Field Ops';
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

grant execute on function public.create_expense(public.expense_type, numeric, date, date, uuid, text, uuid, numeric, boolean) to authenticated;

grant execute on function public.assign_rental_car(uuid, date, date, text, text, text, numeric) to authenticated;
grant execute on function public.accrue_rental_cars(date) to service_role;
grant execute on function public.return_rental_car(uuid, date, numeric) to authenticated;
grant execute on function public.bulk_assign_housing(uuid, date, numeric, numeric, jsonb) to authenticated;
grant execute on function public.accrue_housing_nightly(date) to service_role;
grant execute on function public.request_housing_checkout(uuid) to authenticated;
grant execute on function public.approve_housing_checkout(uuid, date) to authenticated;
grant execute on function public.update_housing_rates(uuid, numeric, numeric) to authenticated;
grant execute on function public.mark_brex_for_reimbursement(uuid) to authenticated;
grant execute on function public.review_brex_reimbursement(uuid, boolean) to authenticated;

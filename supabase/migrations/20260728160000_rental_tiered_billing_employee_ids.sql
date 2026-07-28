alter table public.expense_records
  add column if not exists rental_assignment_id uuid references public.rental_car_assignments (id) on delete set null,
  add column if not exists rental_charge_kind text,
  add column if not exists rental_day date,
  add column if not exists rental_period_start date,
  add column if not exists rental_period_end date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expense_records_rental_charge_kind_check'
  ) then
    alter table public.expense_records
      add constraint expense_records_rental_charge_kind_check
      check (
        rental_charge_kind is null
        or rental_charge_kind in ('daily', 'weekly', 'monthly', 'settlement', 'one_way')
      );
  end if;
end $$;

create index if not exists expense_records_rental_assignment_idx
  on public.expense_records (rental_assignment_id)
  where rental_assignment_id is not null and coalesce(voided, false) = false;

create unique index if not exists expense_records_rental_daily_uidx
  on public.expense_records (rental_assignment_id, rental_day)
  where type = 'car_rental'
    and rental_charge_kind = 'daily'
    and coalesce(voided, false) = false;

create unique index if not exists expense_records_rental_period_uidx
  on public.expense_records (rental_assignment_id, rental_charge_kind, rental_period_start)
  where type = 'car_rental'
    and rental_charge_kind in ('weekly', 'monthly')
    and coalesce(voided, false) = false;

create or replace function public.allocate_employee_id(
  p_first_name text,
  p_last_name text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.next_employee_id();
end;
$$;

grant execute on function public.allocate_employee_id(text, text) to service_role;

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

create or replace function private.rental_soft_void_range(
  p_assignment_id uuid,
  p_period_start date,
  p_period_end date,
  p_kinds text[],
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.expense_records
  set
    voided = true,
    voided_at = now(),
    void_reason = p_reason,
    car_active = false,
    updated_at = now()
  where rental_assignment_id = p_assignment_id
    and type = 'car_rental'
    and rental_charge_kind = any (p_kinds)
    and coalesce(voided, false) = false
    and rental_period_start >= p_period_start
    and rental_period_end <= p_period_end;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function private.accrue_rental_car_day(
  p_assignment public.rental_car_assignments,
  p_day date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_index integer;
  v_month_start_idx integer;
  v_local_day integer;
  v_month_start date;
  v_month_end date;
  v_week_start date;
  v_week_end date;
  v_covered boolean;
begin
  if p_day < p_assignment.pickup_at then
    return;
  end if;
  if p_assignment.return_at is not null and p_day > p_assignment.return_at then
    return;
  end if;

  v_day_index := (p_day - p_assignment.pickup_at) + 1;
  v_month_start_idx := ((v_day_index - 1) / 30) * 30 + 1;
  v_local_day := ((v_day_index - 1) % 30) + 1;
  v_month_start := p_assignment.pickup_at + (v_month_start_idx - 1);
  v_month_end := v_month_start + 29;

  select exists (
    select 1
    from public.expense_records
    where rental_assignment_id = p_assignment.id
      and type = 'car_rental'
      and rental_charge_kind in ('weekly', 'monthly')
      and coalesce(voided, false) = false
      and rental_period_start <= p_day
      and rental_period_end >= p_day
  ) into v_covered;

  if not v_covered then
    if not exists (
      select 1
      from public.expense_records
      where rental_assignment_id = p_assignment.id
        and type = 'car_rental'
        and rental_charge_kind = 'daily'
        and rental_day = p_day
        and coalesce(voided, false) = false
    ) then
      insert into public.expense_records (
        user_id,
        type,
        amount,
        expense_date,
        end_date,
        car_active,
        rental_assignment_id,
        rental_charge_kind,
        rental_day,
        rental_period_start,
        rental_period_end
      ) values (
        p_assignment.user_id,
        'car_rental',
        50,
        p_day,
        p_day,
        true,
        p_assignment.id,
        'daily',
        p_day,
        p_day,
        p_day
      );
    end if;
  end if;

  if v_local_day in (7, 14, 21) then
    v_week_start := v_month_start + (v_local_day - 7);
    v_week_end := v_month_start + (v_local_day - 1);

    perform private.rental_soft_void_range(
      p_assignment.id,
      v_week_start,
      v_week_end,
      array['daily']::text[],
      'Rental weekly conversion'
    );

    if not exists (
      select 1
      from public.expense_records
      where rental_assignment_id = p_assignment.id
        and type = 'car_rental'
        and rental_charge_kind = 'weekly'
        and rental_period_start = v_week_start
        and coalesce(voided, false) = false
    ) then
      insert into public.expense_records (
        user_id,
        type,
        amount,
        expense_date,
        end_date,
        car_active,
        rental_assignment_id,
        rental_charge_kind,
        rental_day,
        rental_period_start,
        rental_period_end
      ) values (
        p_assignment.user_id,
        'car_rental',
        309,
        p_day,
        p_day,
        true,
        p_assignment.id,
        'weekly',
        p_day,
        v_week_start,
        v_week_end
      );
    end if;
  end if;

  if v_local_day = 30 then
    perform private.rental_soft_void_range(
      p_assignment.id,
      v_month_start,
      v_month_end,
      array['daily', 'weekly']::text[],
      'Rental monthly conversion'
    );

    if not exists (
      select 1
      from public.expense_records
      where rental_assignment_id = p_assignment.id
        and type = 'car_rental'
        and rental_charge_kind = 'monthly'
        and rental_period_start = v_month_start
        and coalesce(voided, false) = false
    ) then
      insert into public.expense_records (
        user_id,
        type,
        amount,
        expense_date,
        end_date,
        car_active,
        rental_assignment_id,
        rental_charge_kind,
        rental_day,
        rental_period_start,
        rental_period_end
      ) values (
        p_assignment.user_id,
        'car_rental',
        1146,
        p_day,
        p_day,
        true,
        p_assignment.id,
        'monthly',
        p_day,
        v_month_start,
        v_month_end
      );
    end if;
  end if;
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
  r public.rental_car_assignments;
  v_from date;
  v_to date;
  v_day date;
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

    v_day := v_from;
    while v_day <= v_to loop
      perform private.accrue_rental_car_day(r, v_day);
      v_day := v_day + 1;
    end loop;

    update public.rental_car_assignments
    set last_accrued_on = v_to, updated_at = now()
    where id = r.id;

    v_count := v_count + 1;
  end loop;
  return v_count;
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
      user_id,
      type,
      amount,
      expense_date,
      end_date,
      car_active,
      rental_assignment_id,
      rental_charge_kind,
      rental_day,
      rental_period_start,
      rental_period_end
    ) values (
      p_user_id,
      'car_rental',
      v_fee,
      p_pickup_at,
      p_pickup_at,
      false,
      v_row.id,
      'one_way',
      p_pickup_at,
      p_pickup_at,
      p_pickup_at
    );
  end if;

  return v_row;
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
  v_prior_fee numeric(12, 2);
  v_day date;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  select * into v_row from public.rental_car_assignments where id = p_assignment_id;
  if not found then
    raise exception 'Rental assignment not found';
  end if;

  if not v_row.active then
    raise exception 'Rental already returned';
  end if;

  if p_return_at < v_row.pickup_at then
    raise exception 'Return date before pickup';
  end if;

  v_day := coalesce(v_row.last_accrued_on + 1, v_row.pickup_at);
  while v_day <= p_return_at loop
    perform private.accrue_rental_car_day(v_row, v_day);
    v_day := v_day + 1;
  end loop;

  update public.rental_car_assignments
  set last_accrued_on = greatest(coalesce(last_accrued_on, p_return_at), p_return_at)
  where id = p_assignment_id
  returning * into v_row;

  v_days := greatest(0, (p_return_at - v_row.pickup_at) + 1);
  v_total := public.rental_car_guide_total(v_days);
  v_prior_fee := coalesce(v_row.one_way_fee, 0);
  v_fee := coalesce(p_one_way_fee, v_prior_fee, 0);

  select coalesce(sum(amount), 0) into v_prior
  from public.expense_records
  where rental_assignment_id = v_row.id
    and type = 'car_rental'
    and coalesce(rental_charge_kind, 'daily') in ('daily', 'weekly', 'monthly', 'settlement')
    and coalesce(voided, false) = false;

  if v_prior = 0 then
    select coalesce(sum(amount), 0) into v_prior
    from public.expense_records
    where user_id = v_row.user_id
      and type = 'car_rental'
      and expense_date >= v_row.pickup_at
      and expense_date <= p_return_at
      and car_active = true
      and coalesce(voided, false) = false
      and rental_assignment_id is null;
  end if;

  v_delta := private.round_money(v_total - v_prior);

  if v_delta > 0 then
    insert into public.expense_records (
      user_id,
      type,
      amount,
      expense_date,
      end_date,
      car_active,
      rental_assignment_id,
      rental_charge_kind,
      rental_day,
      rental_period_start,
      rental_period_end
    ) values (
      v_row.user_id,
      'car_rental',
      v_delta,
      p_return_at,
      p_return_at,
      false,
      v_row.id,
      'settlement',
      p_return_at,
      v_row.pickup_at,
      p_return_at
    );
  elsif v_delta < 0 then
    update public.expense_records
    set
      voided = true,
      voided_at = now(),
      voided_by = auth.uid(),
      void_reason = 'Rental true-up reset',
      car_active = false,
      updated_at = now()
    where rental_assignment_id = v_row.id
      and type = 'car_rental'
      and coalesce(rental_charge_kind, 'daily') in ('daily', 'weekly', 'monthly', 'settlement')
      and coalesce(voided, false) = false;

    update public.expense_records
    set
      voided = true,
      voided_at = now(),
      voided_by = auth.uid(),
      void_reason = 'Rental true-up reset',
      car_active = false,
      updated_at = now()
    where user_id = v_row.user_id
      and type = 'car_rental'
      and expense_date >= v_row.pickup_at
      and expense_date <= p_return_at
      and car_active = true
      and coalesce(voided, false) = false
      and rental_assignment_id is null;

    if v_total > 0 then
      insert into public.expense_records (
        user_id,
        type,
        amount,
        expense_date,
        end_date,
        car_active,
        rental_assignment_id,
        rental_charge_kind,
        rental_day,
        rental_period_start,
        rental_period_end
      ) values (
        v_row.user_id,
        'car_rental',
        v_total,
        p_return_at,
        p_return_at,
        false,
        v_row.id,
        'settlement',
        p_return_at,
        v_row.pickup_at,
        p_return_at
      );
    end if;
  end if;

  if v_fee > v_prior_fee then
    insert into public.expense_records (
      user_id,
      type,
      amount,
      expense_date,
      end_date,
      car_active,
      rental_assignment_id,
      rental_charge_kind,
      rental_day,
      rental_period_start,
      rental_period_end
    ) values (
      v_row.user_id,
      'car_rental',
      private.round_money(v_fee - v_prior_fee),
      p_return_at,
      p_return_at,
      false,
      v_row.id,
      'one_way',
      p_return_at,
      p_return_at,
      p_return_at
    );
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
  where rental_assignment_id = v_row.id
    and type = 'car_rental'
    and car_active = true
    and coalesce(voided, false) = false;

  update public.expense_records
  set car_active = false, updated_at = now()
  where user_id = v_row.user_id
    and type = 'car_rental'
    and car_active = true
    and rental_assignment_id is null;

  return v_row;
end;
$$;

grant execute on function public.accrue_rental_cars(date) to service_role;
grant execute on function public.assign_rental_car(uuid, date, date, text, text, text, numeric) to authenticated;
grant execute on function public.return_rental_car(uuid, date, numeric) to authenticated;

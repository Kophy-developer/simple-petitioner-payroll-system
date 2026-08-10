drop function if exists public.return_rental_car(uuid, date, numeric);

create or replace function public.return_rental_car(
  p_assignment_id uuid,
  p_return_at date default current_date,
  p_one_way_fee numeric default null,
  p_dropoff_location text default null
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
  select * into v_row from public.rental_car_assignments where id = p_assignment_id;
  if not found then
    raise exception 'Rental assignment not found';
  end if;

  if not (private.is_admin_plus() or v_row.user_id = auth.uid()) then
    raise exception 'Not authorized';
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
  set
    last_accrued_on = greatest(coalesce(last_accrued_on, p_return_at), p_return_at),
    dropoff_location = coalesce(nullif(trim(p_dropoff_location), ''), dropoff_location)
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
      'one_way_fee',
      p_return_at,
      p_return_at,
      p_return_at
    );
  end if;

  update public.rental_car_assignments
  set
    active = false,
    return_at = p_return_at,
    one_way_fee = v_fee,
    trued_up_at = now(),
    updated_at = now()
  where id = p_assignment_id
  returning * into v_row;

  update public.expense_records
  set car_active = false, updated_at = now()
  where rental_assignment_id = v_row.id
    and coalesce(voided, false) = false;

  return v_row;
end;
$$;

grant execute on function public.return_rental_car(uuid, date, numeric, text) to authenticated;

create table if not exists public.clock_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  start_lat double precision not null,
  start_lng double precision not null,
  end_lat double precision,
  end_lng double precision,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clock_sessions_one_open_per_user
  on public.clock_sessions (user_id)
  where status = 'open';

create index if not exists clock_sessions_user_started_idx
  on public.clock_sessions (user_id, started_at desc);

create table if not exists public.clock_location_pings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.clock_sessions (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  created_at timestamptz not null default now()
);

create index if not exists clock_location_pings_session_idx
  on public.clock_location_pings (session_id, recorded_at);

alter table public.clock_sessions enable row level security;
alter table public.clock_location_pings enable row level security;

drop policy if exists clock_sessions_select on public.clock_sessions;
create policy clock_sessions_select on public.clock_sessions
for select to authenticated
using (private.can_view_user(user_id));

drop policy if exists clock_sessions_insert on public.clock_sessions;
create policy clock_sessions_insert on public.clock_sessions
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists clock_sessions_update on public.clock_sessions;
create policy clock_sessions_update on public.clock_sessions
for update to authenticated
using (user_id = auth.uid() or private.is_admin_plus())
with check (user_id = auth.uid() or private.is_admin_plus());

drop policy if exists clock_pings_select on public.clock_location_pings;
create policy clock_pings_select on public.clock_location_pings
for select to authenticated
using (
  exists (
    select 1 from public.clock_sessions s
    where s.id = session_id and private.can_view_user(s.user_id)
  )
);

drop policy if exists clock_pings_insert on public.clock_location_pings;
create policy clock_pings_insert on public.clock_location_pings
for insert to authenticated
with check (
  exists (
    select 1 from public.clock_sessions s
    where s.id = session_id
      and s.user_id = auth.uid()
      and s.status = 'open'
  )
);

grant select, insert, update on public.clock_sessions to authenticated;
grant select, insert on public.clock_location_pings to authenticated;

create or replace function public.clock_in(
  p_lat double precision,
  p_lng double precision
)
returns public.clock_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.clock_sessions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if exists (
    select 1 from public.clock_sessions
    where user_id = auth.uid() and status = 'open'
  ) then
    raise exception 'Already clocked in';
  end if;

  insert into public.clock_sessions (user_id, start_lat, start_lng, status)
  values (auth.uid(), p_lat, p_lng, 'open')
  returning * into v_row;

  insert into public.clock_location_pings (session_id, lat, lng)
  values (v_row.id, p_lat, p_lng);

  return v_row;
end;
$$;

create or replace function public.clock_out(
  p_lat double precision,
  p_lng double precision
)
returns public.clock_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.clock_sessions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.clock_sessions
  where user_id = auth.uid() and status = 'open'
  for update;

  if not found then
    raise exception 'No open clock session';
  end if;

  insert into public.clock_location_pings (session_id, lat, lng)
  values (v_row.id, p_lat, p_lng);

  update public.clock_sessions
  set
    ended_at = now(),
    end_lat = p_lat,
    end_lng = p_lng,
    status = 'closed',
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.clock_ping(
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null
)
returns public.clock_location_pings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.clock_sessions;
  v_ping public.clock_location_pings;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_session
  from public.clock_sessions
  where user_id = auth.uid() and status = 'open';

  if not found then
    raise exception 'No open clock session';
  end if;

  insert into public.clock_location_pings (session_id, lat, lng, accuracy)
  values (v_session.id, p_lat, p_lng, p_accuracy)
  returning * into v_ping;

  return v_ping;
end;
$$;

grant execute on function public.clock_in(double precision, double precision) to authenticated;
grant execute on function public.clock_out(double precision, double precision) to authenticated;
grant execute on function public.clock_ping(double precision, double precision, double precision) to authenticated;

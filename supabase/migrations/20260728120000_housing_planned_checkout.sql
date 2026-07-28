alter table public.lodging_occupancies
  add column if not exists planned_check_out_date date;

drop function if exists public.bulk_assign_housing(uuid, date, numeric, numeric, jsonb);

create or replace function public.bulk_assign_housing(
  p_property_id uuid,
  p_check_in date,
  p_full_rate numeric,
  p_half_rate numeric,
  p_assignments jsonb,
  p_planned_check_out date default null
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

  if p_planned_check_out is not null and p_planned_check_out < p_check_in then
    raise exception 'Planned checkout must be on or after check-in';
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
      check_in_at, daily_amount, share_kind, last_accrued_on, planned_check_out_date
    ) values (
      p_property_id, v_user, coalesce(v_item ->> 'room_number', ''),
      1, p_check_in::timestamptz, v_daily, v_share, p_check_in - 1, p_planned_check_out
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
    elsif r.planned_check_out_date is not null then
      v_to := least(v_to, r.planned_check_out_date - 1);
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

grant execute on function public.bulk_assign_housing(uuid, date, numeric, numeric, jsonb, date) to authenticated;
grant execute on function public.accrue_housing_nightly(date) to service_role;

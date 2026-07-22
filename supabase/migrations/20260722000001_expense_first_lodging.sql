create or replace function public.normalize_lodging_name(p_name text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
$$;

alter table public.lodging_properties
  add column if not exists name_normalized text;

update public.lodging_properties
set name_normalized = public.normalize_lodging_name(name)
where name_normalized is null or name_normalized = '';

with ranked as (
  select
    id,
    kind,
    public.normalize_lodging_name(name) as norm,
    row_number() over (
      partition by kind, public.normalize_lodging_name(name)
      order by created_at, id
    ) as rn
  from public.lodging_properties
),
keepers as (
  select id, kind, norm from ranked where rn = 1
),
dupes as (
  select id, kind, norm from ranked where rn > 1
)
update public.lodging_occupancies o
set property_id = k.id
from dupes d
join keepers k on k.kind = d.kind and k.norm = d.norm
where o.property_id = d.id;

delete from public.lodging_properties p
using (
  select
    id,
    row_number() over (
      partition by kind, public.normalize_lodging_name(name)
      order by created_at, id
    ) as rn
  from public.lodging_properties
) ranked
where p.id = ranked.id and ranked.rn > 1;

alter table public.lodging_properties
  alter column name_normalized set not null;

create unique index if not exists lodging_properties_kind_name_uidx
  on public.lodging_properties (kind, name_normalized);

create or replace function private.lodging_properties_set_normalized()
returns trigger
language plpgsql
as $$
begin
  new.name := trim(new.name);
  new.name_normalized := public.normalize_lodging_name(new.name);
  if new.name_normalized = '' then
    raise exception 'Property name is required';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lodging_properties_normalize on public.lodging_properties;
create trigger lodging_properties_normalize
before insert or update of name on public.lodging_properties
for each row execute function private.lodging_properties_set_normalized();

drop policy if exists lodging_props_admin on public.lodging_properties;

create policy lodging_props_insert on public.lodging_properties
for insert to authenticated
with check (
  private.is_admin_plus()
  or private.current_role() in ('team_lead', 'petitioner', 'canvasser')
);

create policy lodging_props_update on public.lodging_properties
for update to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

create policy lodging_props_delete on public.lodging_properties
for delete to authenticated
using (private.is_admin_plus());

create or replace function public.find_or_create_lodging_property(
  p_kind public.lodging_kind,
  p_name text,
  p_daily_total numeric default null,
  p_room_count integer default null,
  p_room_rate numeric default null,
  p_address text default null
)
returns public.lodging_properties
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text := public.normalize_lodging_name(p_name);
  v_row public.lodging_properties;
begin
  if v_norm = '' then
    raise exception 'Property name is required';
  end if;

  if not private.is_admin_plus()
     and private.current_role() not in ('team_lead', 'petitioner', 'canvasser') then
    raise exception 'Not authorized';
  end if;

  select * into v_row
  from public.lodging_properties
  where kind = p_kind and name_normalized = v_norm
  limit 1;

  if found then
    if p_kind = 'airbnb' then
      update public.lodging_properties
      set
        daily_total = coalesce(p_daily_total, daily_total),
        room_count = coalesce(p_room_count, room_count),
        address = coalesce(p_address, address),
        updated_at = now()
      where id = v_row.id
      returning * into v_row;
    else
      update public.lodging_properties
      set
        room_rate = coalesce(p_room_rate, room_rate),
        address = coalesce(p_address, address),
        updated_at = now()
      where id = v_row.id
      returning * into v_row;
    end if;
    return v_row;
  end if;

  insert into public.lodging_properties (
    kind, name, address, daily_total, room_count, room_rate, created_by
  )
  values (
    p_kind,
    trim(p_name),
    p_address,
    case when p_kind = 'airbnb' then p_daily_total else null end,
    case when p_kind = 'airbnb' then coalesce(p_room_count, 1) else null end,
    case when p_kind = 'hotel' then p_room_rate else null end,
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.create_lodging_expense(
  p_kind public.lodging_kind,
  p_property_id uuid default null,
  p_property_name text default null,
  p_daily_total numeric default null,
  p_room_count integer default null,
  p_room_rate numeric default null,
  p_room_number text default '',
  p_occupants_in_room integer default 1,
  p_check_in_date date default current_date,
  p_check_out_date date default null,
  p_amount numeric default null,
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
  v_prop public.lodging_properties;
  v_occupants integer := greatest(1, coalesce(p_occupants_in_room, 1));
  v_daily numeric(12, 2);
  v_occ public.lodging_occupancies;
  v_type public.expense_type;
  v_amount numeric(12, 2) := p_amount;
  v_row public.expense_records;
begin
  if v_user <> auth.uid() and not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  if not private.is_admin_plus()
     and private.current_role() not in ('team_lead', 'petitioner', 'canvasser') then
    raise exception 'Not authorized';
  end if;

  if p_check_out_date is not null and p_check_out_date < p_check_in_date then
    raise exception 'Check-out cannot be before check-in';
  end if;

  if p_property_id is not null then
    select * into v_prop from public.lodging_properties where id = p_property_id;
    if not found then
      raise exception 'Property not found';
    end if;
    if v_prop.kind <> p_kind then
      raise exception 'Property kind mismatch';
    end if;
    if p_kind = 'airbnb' and (p_daily_total is not null or p_room_count is not null) then
      update public.lodging_properties
      set
        daily_total = coalesce(p_daily_total, daily_total),
        room_count = coalesce(p_room_count, room_count),
        updated_at = now()
      where id = v_prop.id
      returning * into v_prop;
    elsif p_kind = 'hotel' and p_room_rate is not null then
      update public.lodging_properties
      set room_rate = p_room_rate, updated_at = now()
      where id = v_prop.id
      returning * into v_prop;
    end if;
  else
    v_prop := public.find_or_create_lodging_property(
      p_kind,
      p_property_name,
      p_daily_total,
      p_room_count,
      p_room_rate,
      null
    );
  end if;

  if p_kind = 'airbnb' then
    v_daily := private.round_money(
      coalesce(v_prop.daily_total, 0)
      / greatest(1, coalesce(v_prop.room_count, 1))
      / v_occupants
    );
    v_type := 'housing';
  else
    v_daily := private.round_money(coalesce(v_prop.room_rate, 0) / v_occupants);
    v_type := 'hotel_travel';
  end if;

  if v_amount is null then
    v_amount := v_daily;
  end if;

  if v_amount is null then
    raise exception 'Amount is required';
  end if;

  insert into public.lodging_occupancies (
    property_id, user_id, room_number, occupants_in_room,
    check_in_at, check_out_at, check_out_date, check_out_backdated, daily_amount
  )
  values (
    v_prop.id,
    v_user,
    coalesce(p_room_number, ''),
    v_occupants,
    p_check_in_date::timestamptz,
    case when p_check_out_date is not null then (p_check_out_date::timestamp + interval '12 hours') at time zone 'utc' else null end,
    case when p_check_out_date is not null then p_check_out_date else null end,
    false,
    v_daily
  )
  returning * into v_occ;

  insert into public.expense_records (
    user_id, issue_id, type, amount, receipt_path, expense_date, end_date,
    lodging_occupancy_id, tolls_amount, car_active
  )
  values (
    v_user, p_issue_id, v_type, v_amount, p_receipt_path, p_check_in_date, p_check_out_date,
    v_occ.id, 0, false
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.checkout_lodging_stay(
  p_occupancy_id uuid,
  p_check_out_date date default current_date,
  p_backdated boolean default false
)
returns public.lodging_occupancies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occ public.lodging_occupancies;
begin
  select * into v_occ from public.lodging_occupancies where id = p_occupancy_id;
  if not found then
    raise exception 'Stay not found';
  end if;

  if v_occ.user_id <> auth.uid() and not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  if v_occ.check_out_at is not null or v_occ.check_out_date is not null then
    raise exception 'Stay already checked out';
  end if;

  update public.lodging_occupancies
  set
    check_out_at = case when p_backdated then null else now() end,
    check_out_date = case when p_backdated then p_check_out_date else null end,
    check_out_backdated = coalesce(p_backdated, false),
    updated_at = now()
  where id = p_occupancy_id
  returning * into v_occ;

  update public.expense_records
  set
    end_date = coalesce(p_check_out_date, current_date),
    updated_at = now()
  where lodging_occupancy_id = p_occupancy_id
    and end_date is null;

  return v_occ;
end;
$$;

create or replace function public.merge_lodging_properties(
  p_keep_id uuid,
  p_merge_id uuid
)
returns public.lodging_properties
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep public.lodging_properties;
  v_merge public.lodging_properties;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  if p_keep_id = p_merge_id then
    raise exception 'Cannot merge a property into itself';
  end if;

  select * into v_keep from public.lodging_properties where id = p_keep_id;
  if not found then
    raise exception 'Keep property not found';
  end if;
  select * into v_merge from public.lodging_properties where id = p_merge_id;
  if not found then
    raise exception 'Merge property not found';
  end if;
  if v_keep.kind <> v_merge.kind then
    raise exception 'Cannot merge different property kinds';
  end if;

  update public.lodging_occupancies
  set property_id = p_keep_id, updated_at = now()
  where property_id = p_merge_id;

  delete from public.lodging_properties where id = p_merge_id;

  return v_keep;
end;
$$;

grant execute on function public.normalize_lodging_name(text) to authenticated;
grant execute on function public.find_or_create_lodging_property(
  public.lodging_kind, text, numeric, integer, numeric, text
) to authenticated;
grant execute on function public.create_lodging_expense(
  public.lodging_kind, uuid, text, numeric, integer, numeric, text, integer, date, date, numeric, uuid, text, uuid
) to authenticated;
grant execute on function public.checkout_lodging_stay(uuid, date, boolean) to authenticated;
grant execute on function public.merge_lodging_properties(uuid, uuid) to authenticated;

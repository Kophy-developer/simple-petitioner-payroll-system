create or replace function private.enforce_profile_column_guards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_priv_changed boolean := false;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if auth.uid() is null and current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Profile id cannot be changed';
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.hourly_wage is distinct from old.hourly_wage
     or new.wage_currency is distinct from old.wage_currency
     or new.profile_tags is distinct from old.profile_tags
     or new.is_lotus is distinct from old.is_lotus
     or new.sub_account_id is distinct from old.sub_account_id
     or new.employee_id is distinct from old.employee_id
     or new.brex_user_id is distinct from old.brex_user_id
     or new.invite_sent_at is distinct from old.invite_sent_at
  then
    v_priv_changed := true;
  end if;

  if not v_priv_changed then
    return new;
  end if;

  if not private.is_admin_plus() then
    raise exception 'Not authorized to change privileged profile fields';
  end if;

  if old.role = 'super_admin' and not private.is_super_admin() then
    raise exception 'Only super admin can modify a super admin';
  end if;

  if new.role = 'super_admin' and not private.is_super_admin() then
    raise exception 'Only super admin can assign super admin';
  end if;

  if new.role is distinct from old.role
     and old.role = 'super_admin'
     and not private.is_super_admin() then
    raise exception 'Only super admin can change a super admin role';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_column_guards on public.profiles;
create trigger profiles_enforce_column_guards
before update on public.profiles
for each row
execute function private.enforce_profile_column_guards();

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

drop function if exists public.update_user_admin(uuid, public.user_role, numeric, public.wage_currency, public.user_status);
drop function if exists public.update_user_admin(
  uuid, public.user_role, numeric, public.wage_currency, public.user_status,
  text, text, boolean, uuid
);

create or replace function public.update_user_admin(
  p_user_id uuid,
  p_role public.user_role,
  p_hourly_wage numeric default null,
  p_wage_currency public.wage_currency default null,
  p_status public.user_status default 'active',
  p_employee_id text default null,
  p_brex_user_id text default null,
  p_is_lotus boolean default null,
  p_sub_account_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.profiles;
  v_target_role public.user_role;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  select role into v_target_role from public.profiles where id = p_user_id;
  if v_target_role is null then
    raise exception 'User not found';
  end if;

  if v_target_role = 'super_admin' and not private.is_super_admin() then
    raise exception 'Only super admin can modify a super admin';
  end if;

  if p_role = 'super_admin' and not private.is_super_admin() then
    raise exception 'Only super admin can assign super admin';
  end if;

  update public.profiles
  set
    role = p_role,
    hourly_wage = p_hourly_wage,
    wage_currency = p_wage_currency,
    status = p_status,
    employee_id = case
      when p_employee_id is null then employee_id
      else nullif(trim(p_employee_id), '')
    end,
    brex_user_id = case
      when p_brex_user_id is null then brex_user_id
      else nullif(trim(p_brex_user_id), '')
    end,
    is_lotus = coalesce(p_is_lotus, is_lotus),
    sub_account_id = coalesce(p_sub_account_id, sub_account_id),
    updated_at = now()
  where id = p_user_id
  returning * into v_row;

  if not found then
    raise exception 'User not found';
  end if;

  return v_row;
end;
$fn$;

grant execute on function public.update_user_admin(
  uuid, public.user_role, numeric, public.wage_currency, public.user_status,
  text, text, boolean, uuid
) to authenticated;

create or replace function public.admin_set_user_lotus(
  p_user_id uuid,
  p_is_lotus boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
  v_target_role public.user_role;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  select role into v_target_role from public.profiles where id = p_user_id;
  if v_target_role is null then
    raise exception 'User not found';
  end if;
  if v_target_role = 'super_admin' and not private.is_super_admin() then
    raise exception 'Only super admin can modify a super admin';
  end if;

  update public.profiles
  set is_lotus = coalesce(p_is_lotus, false), updated_at = now()
  where id = p_user_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_set_user_sub_account(
  p_user_id uuid,
  p_sub_account_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
  v_target_role public.user_role;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  if p_sub_account_id is null then
    raise exception 'Sub-account is required';
  end if;

  if not exists (select 1 from public.sub_accounts where id = p_sub_account_id) then
    raise exception 'Sub-account not found';
  end if;

  select role into v_target_role from public.profiles where id = p_user_id;
  if v_target_role is null then
    raise exception 'User not found';
  end if;
  if v_target_role = 'super_admin' and not private.is_super_admin() then
    raise exception 'Only super admin can modify a super admin';
  end if;

  update public.profiles
  set sub_account_id = p_sub_account_id, updated_at = now()
  where id = p_user_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_set_user_lotus(uuid, boolean) to authenticated;
grant execute on function public.admin_set_user_sub_account(uuid, uuid) to authenticated;

create or replace function public.offboard_user(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.profiles;
  v_target_role public.user_role;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  select role into v_target_role from public.profiles where id = p_user_id;
  if v_target_role is null then
    raise exception 'User not found';
  end if;

  if v_target_role = 'super_admin' and not private.is_super_admin() then
    raise exception 'Only super admin can offboard a super admin';
  end if;

  update public.profiles
  set status = 'offboarded', updated_at = now()
  where id = p_user_id
  returning * into v_row;

  delete from auth.sessions where user_id = p_user_id;
  delete from auth.refresh_tokens where user_id = p_user_id;

  update auth.users
  set banned_until = 'infinity'::timestamptz,
      updated_at = now()
  where id = p_user_id;

  return v_row;
end;
$$;

drop policy if exists brex_update_self on public.brex_transactions;

revoke update on public.brex_transactions from authenticated;
grant select on public.brex_transactions to authenticated;
grant insert on public.brex_transactions to authenticated;

delete from public.brex_transactions
where disputed_at is null
  and (
    upper(replace(replace(coalesce(expense_status, ''), '-', '_'), ' ', '_'))
      in ('CANCELED', 'CANCELLED', 'VOIDED', 'DRAFT', 'FAILED')
    or upper(replace(replace(coalesce(payment_status, ''), '-', '_'), ' ', '_'))
      in ('CANCELED', 'CANCELLED', 'DECLINED', 'VOIDED', 'FAILED')
  );

drop function if exists public.lookup_user_for_login(text);

alter table public.login_otp_codes enable row level security;
revoke all on table public.login_otp_codes from anon, authenticated, public;

drop policy if exists submission_records_insert on public.submission_records;
create policy submission_records_insert on public.submission_records
for insert to authenticated
with check (
  user_id = auth.uid()
  or private.is_admin_plus()
);

drop policy if exists turn_in_entries_write on public.turn_in_entries;

create policy turn_in_entries_insert on public.turn_in_entries
for insert to authenticated
with check (
  user_id = auth.uid()
  or private.is_admin_plus()
);

create policy turn_in_entries_update on public.turn_in_entries
for update to authenticated
using (
  user_id = auth.uid()
  or private.is_admin_plus()
)
with check (
  user_id = auth.uid()
  or private.is_admin_plus()
);

create policy turn_in_entries_delete on public.turn_in_entries
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
  v_admin boolean := private.is_admin_plus();
begin
  if v_norm = '' then
    raise exception 'Property name is required';
  end if;

  if not v_admin
     and private.current_role() not in ('team_lead', 'petitioner', 'canvasser') then
    raise exception 'Not authorized';
  end if;

  select * into v_row
  from public.lodging_properties
  where kind = p_kind and name_normalized = v_norm
  limit 1;

  if found then
    if v_admin then
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
    elsif p_address is not null and nullif(trim(p_address), '') is not null then
      update public.lodging_properties
      set
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
  v_admin boolean := private.is_admin_plus();
begin
  if v_user <> auth.uid() and not v_admin then
    raise exception 'Not authorized';
  end if;

  if not v_admin
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
    if v_admin then
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

create or replace function private.recalculate_ledger_line(p_column_id uuid, p_user_id uuid)
returns public.ledger_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col public.turn_in_petition_columns;
  v_turn public.turn_ins;
  v_entry public.turn_in_entries;
  v_val public.turn_in_validity;
  v_pay numeric(12, 4);
  v_benchmark numeric(6, 2);
  v_est numeric(12, 2);
  v_validity numeric(6, 2);
  v_pay_rate numeric(12, 6);
  v_payable integer;
  v_total numeric(12, 2);
  v_upfront numeric(12, 2);
  v_hold numeric(12, 2);
  v_pending boolean;
  v_row public.ledger_lines;
begin
  if not private.is_admin_plus()
     and auth.uid() is distinct from p_user_id
     and private.current_role() is distinct from 'validator' then
    raise exception 'Not authorized';
  end if;

  select * into v_col from public.turn_in_petition_columns where id = p_column_id;
  if v_col.id is null then
    raise exception 'Column not found';
  end if;
  select * into v_turn from public.turn_ins where id = v_col.turn_in_id;
  select * into v_entry from public.turn_in_entries
    where column_id = p_column_id and user_id = p_user_id;
  select * into v_val from public.turn_in_validity
    where column_id = p_column_id and user_id = p_user_id;

  v_pay := private.pay_for_user(p_user_id, v_col.priced_line_id);
  v_benchmark := coalesce(v_col.benchmark_pct, v_turn.benchmark_pct, 75);
  v_est := private.round_money(coalesce(v_entry.sigs, 0) * v_pay);
  v_pending := v_val.id is null;

  if v_pending then
    v_validity := null;
    v_pay_rate := 0;
    v_payable := null;
    v_total := null;
    v_upfront := null;
    v_hold := null;
  else
    v_validity := case
      when coalesce(v_val.usable, 0) = 0 then 0
      else round((v_val.valid::numeric / v_val.usable::numeric) * 100, 2)
    end;
    v_pay_rate := least(v_validity / v_benchmark, 1);
    v_payable := floor(v_pay_rate * v_val.usable)::integer;
    v_total := private.round_money(v_payable * v_pay);
    v_upfront := private.round_money(v_total * 0.85);
    v_hold := private.round_money(v_total * 0.15);
  end if;

  insert into public.ledger_lines (
    user_id, turn_in_id, column_id, sigs, pay, estimated_pay,
    dups, usable, valid, validity_pct, pay_rate, payable, total_pay,
    upfront, hold, benchmark_pct, validity_pending, recalculated_at
  ) values (
    p_user_id, v_col.turn_in_id, p_column_id,
    coalesce(v_entry.sigs, 0), v_pay, v_est,
    case when v_pending then null else v_val.dups end,
    case when v_pending then null else v_val.usable end,
    case when v_pending then null else v_val.valid end,
    v_validity, coalesce(v_pay_rate, 0), v_payable, v_total,
    v_upfront, v_hold, v_benchmark, v_pending,
    case when v_pending then null else now() end
  )
  on conflict (column_id, user_id) do update set
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
    benchmark_pct = excluded.benchmark_pct,
    validity_pending = excluded.validity_pending,
    recalculated_at = excluded.recalculated_at,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

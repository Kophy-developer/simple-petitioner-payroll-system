insert into public.app_config (key, value)
values ('hold_pct', '15'::jsonb)
on conflict (key) do nothing;

create or replace function private.hold_pct()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (value #>> '{}')::numeric from public.app_config where key = 'hold_pct'),
    15
  );
$$;

create or replace function public.set_hold_pct(p_pct numeric)
returns public.app_config
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.app_config;
  v_hold numeric;
  v_live numeric;
begin
  if not private.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'Hold percent must be between 0 and 100';
  end if;

  insert into public.app_config (key, value, updated_by)
  values ('hold_pct', to_jsonb(p_pct), auth.uid())
  on conflict (key) do update set
    value = excluded.value,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_row;

  v_hold := private.hold_pct() / 100.0;
  v_live := 1 - v_hold;

  update public.ledger_lines
  set
    upfront = private.round_money(total_pay * v_live),
    hold = private.round_money(total_pay * v_hold),
    recalculated_at = now(),
    updated_at = now()
  where total_pay is not null
    and validity_pending = false;

  update public.ledger_rows
  set
    upfront = private.round_money(total_pay * v_live),
    hold = private.round_money(total_pay * v_hold),
    recalculated_at = now(),
    updated_at = now()
  where total_pay is not null
    and validity_pending = false;

  return v_row;
end;
$fn$;

grant execute on function public.set_hold_pct(numeric) to authenticated;

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
  v_daily numeric := case when v_admin then p_daily_total else null end;
  v_rate numeric := case when v_admin then p_room_rate else null end;
  v_rooms integer := case when v_admin then p_room_count else null end;
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
          daily_total = coalesce(v_daily, daily_total),
          room_count = coalesce(v_rooms, room_count),
          address = coalesce(p_address, address),
          updated_at = now()
        where id = v_row.id
        returning * into v_row;
      else
        update public.lodging_properties
        set
          room_rate = coalesce(v_rate, room_rate),
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
    case when p_kind = 'airbnb' then v_daily else null end,
    case when p_kind = 'airbnb' then coalesce(v_rooms, 1) else null end,
    case when p_kind = 'hotel' then v_rate else null end,
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
  v_daily_in numeric := case when v_admin then p_daily_total else null end;
  v_rate_in numeric := case when v_admin then p_room_rate else null end;
  v_rooms_in integer := case when v_admin then p_room_count else null end;
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
      if p_kind = 'airbnb' and (v_daily_in is not null or v_rooms_in is not null) then
        update public.lodging_properties
        set
          daily_total = coalesce(v_daily_in, daily_total),
          room_count = coalesce(v_rooms_in, room_count),
          updated_at = now()
        where id = v_prop.id
        returning * into v_prop;
      elsif p_kind = 'hotel' and v_rate_in is not null then
        update public.lodging_properties
        set room_rate = v_rate_in, updated_at = now()
        where id = v_prop.id
        returning * into v_prop;
      end if;
    end if;
  else
    v_prop := public.find_or_create_lodging_property(
      p_kind,
      p_property_name,
      v_daily_in,
      v_rooms_in,
      v_rate_in,
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
  v_hold_frac numeric;
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
  v_hold_frac := private.hold_pct() / 100.0;

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
    v_upfront := private.round_money(v_total * (1 - v_hold_frac));
    v_hold := private.round_money(v_total * v_hold_frac);
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
  v_hold_frac numeric;
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
  v_hold_frac := private.hold_pct() / 100.0;

  if v_issue.pay_model = 'per_valid_sig' then
    if v_validity.id is not null then
      v_payable := v_validity.valid;
      v_total := private.round_money(v_payable * v_pay_rate);
      v_upfront := private.round_money(v_total * (1 - v_hold_frac));
      v_hold := private.round_money(v_total * v_hold_frac);
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
      v_upfront := private.round_money(v_total * (1 - v_hold_frac));
      v_hold := private.round_money(v_total * v_hold_frac);
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

alter table public.expense_records
  add column if not exists voided boolean not null default false,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles (id) on delete set null,
  add column if not exists void_reason text;

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

  v_days := greatest(0, (p_return_at - v_row.pickup_at) + 1);
  v_total := public.rental_car_guide_total(v_days);
  v_prior_fee := coalesce(v_row.one_way_fee, 0);
  v_fee := coalesce(p_one_way_fee, v_prior_fee, 0);

  select coalesce(sum(amount), 0) into v_prior
  from public.expense_records
  where user_id = v_row.user_id
    and type = 'car_rental'
    and expense_date >= v_row.pickup_at
    and expense_date <= p_return_at
    and car_active = true
    and coalesce(voided, false) = false;

  v_delta := private.round_money(v_total - v_prior);

  if v_delta > 0 then
    insert into public.expense_records (user_id, type, amount, expense_date, end_date, car_active)
    values (v_row.user_id, 'car_rental', v_delta, p_return_at, p_return_at, false);
  elsif v_delta < 0 then
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
      and coalesce(voided, false) = false;

    if v_total > 0 then
      insert into public.expense_records (user_id, type, amount, expense_date, end_date, car_active)
      values (v_row.user_id, 'car_rental', v_total, p_return_at, p_return_at, false);
    end if;
  end if;

  if v_fee > v_prior_fee then
    insert into public.expense_records (user_id, type, amount, expense_date, end_date, car_active)
    values (
      v_row.user_id,
      'car_rental',
      private.round_money(v_fee - v_prior_fee),
      p_return_at,
      p_return_at,
      false
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
  where user_id = v_row.user_id and type = 'car_rental' and car_active = true;

  return v_row;
end;
$$;

alter table public.payment_events
  add column if not exists voided boolean not null default false,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles (id) on delete set null,
  add column if not exists void_reason text;

alter table public.brex_transactions
  add column if not exists payment_event_id uuid references public.payment_events (id) on delete set null;

alter table public.brex_transactions
  drop constraint if exists brex_transactions_reimbursement_status_check;

alter table public.brex_transactions
  add constraint brex_transactions_reimbursement_status_check
  check (reimbursement_status in ('none', 'pending', 'approved', 'rejected', 'disputed', 'voided'));

create or replace function public.void_expense(
  p_expense_id uuid,
  p_reason text
)
returns public.expense_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.expense_records;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;
  if v_reason is null then
    raise exception 'Void reason is required';
  end if;

  select * into v_row from public.expense_records where id = p_expense_id;
  if not found then
    raise exception 'Expense not found';
  end if;
  if v_row.voided then
    raise exception 'Expense already voided';
  end if;

  update public.expense_records
  set
    voided = true,
    voided_at = now(),
    voided_by = auth.uid(),
    void_reason = v_reason,
    car_active = false,
    updated_at = now()
  where id = p_expense_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.void_payment_event(
  p_payment_id uuid,
  p_reason text
)
returns public.payment_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.payment_events;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;
  if v_reason is null then
    raise exception 'Void reason is required';
  end if;

  select * into v_row from public.payment_events where id = p_payment_id;
  if not found then
    raise exception 'Payment event not found';
  end if;
  if v_row.voided then
    raise exception 'Payment already voided';
  end if;

  update public.payment_events
  set
    voided = true,
    voided_at = now(),
    voided_by = auth.uid(),
    void_reason = v_reason,
    updated_at = now()
  where id = p_payment_id
  returning * into v_row;

  update public.brex_transactions
  set
    reimbursement_status = 'voided',
    updated_at = now()
  where payment_event_id = p_payment_id
    and reimbursement_status = 'approved';

  return v_row;
end;
$$;

create or replace function public.void_brex_reimbursement(
  p_brex_id uuid,
  p_reason text
)
returns public.brex_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.brex_transactions;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;
  if v_reason is null then
    raise exception 'Void reason is required';
  end if;

  select * into v_row from public.brex_transactions where id = p_brex_id;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_row.reimbursement_status <> 'approved' then
    raise exception 'Only approved reimbursements can be voided';
  end if;

  if v_row.payment_event_id is not null then
    perform public.void_payment_event(v_row.payment_event_id, v_reason);
  end if;

  update public.brex_transactions
  set
    reimbursement_status = 'voided',
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
  v_pay public.payment_events;
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
  )
  returning * into v_pay;

  update public.brex_transactions
  set
    reimbursement_status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    payment_event_id = v_pay.id,
    updated_at = now()
  where id = p_brex_id
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
    and type <> 'upfront_draw'
    and coalesce(voided, false) = false;

  select coalesce(sum(amount), 0)
  into v_total_paid
  from public.payment_events
  where user_id = p_user_id
    and extract(year from event_date) = v_year
    and bucket <> 'reimburse'
    and event_type in ('onpay', 'cashapp', 'full_pay', 'paid', 'advances', 'flight_advance')
    and coalesce(voided, false) = false;

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
          and coalesce(voided, false) = false
      ), 0)
    )
  );
end;
$$;

grant execute on function public.void_expense(uuid, text) to authenticated;
grant execute on function public.void_payment_event(uuid, text) to authenticated;
grant execute on function public.void_brex_reimbursement(uuid, text) to authenticated;

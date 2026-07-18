do $$ begin
  alter type public.user_status add value 'offboarded';
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_bucket as enum (
    'payroll',
    'chargebacks',
    'loans_advances',
    'hotel_expense',
    'reimburse',
    'paid'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_event_type as enum (
    'onpay',
    'cashapp',
    'full_pay',
    'upfront',
    'validity_hold',
    'expenses',
    'housing',
    'lodging',
    'bonus',
    'advances',
    'flight_advance',
    'paid',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lodging_kind as enum ('airbnb', 'hotel');
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.expense_type add value 'flight';
exception when duplicate_object then null;
end $$;

create table if not exists public.sub_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.sub_accounts (id, code, name, is_primary) values
  ('b0000001-0000-4000-8000-000000000001', 'BAP', 'Ballot Access Pros', true),
  ('b0000001-0000-4000-8000-000000000002', 'LOTUS', 'Lotus', false)
on conflict (code) do nothing;

alter table public.profiles
  add column if not exists employee_id text,
  add column if not exists phone text,
  add column if not exists sub_account_id uuid references public.sub_accounts (id);

update public.profiles
set sub_account_id = 'b0000001-0000-4000-8000-000000000001'
where sub_account_id is null;

alter table public.profiles
  alter column sub_account_id set default 'b0000001-0000-4000-8000-000000000001';

create unique index if not exists profiles_employee_id_unique
  on public.profiles (employee_id)
  where employee_id is not null;

create table if not exists public.priced_petition_lines (
  id uuid primary key default gen_random_uuid(),
  petition_id uuid references public.petitions (id) on delete set null,
  name text not null,
  code text not null,
  pay numeric(12, 4) not null default 0,
  lotus_pay numeric(12, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint priced_petition_lines_code_unique unique (code)
);

insert into public.priced_petition_lines (petition_id, name, code, pay, lotus_pay)
select p.id, p.name, p.code, p.pay,
  case
    when p.lotus ~ '^[0-9]+(\\.[0-9]+)?$' then p.lotus::numeric
    else p.pay + 0.50
  end
from public.petitions p
on conflict (code) do nothing;

create table if not exists public.turn_ins (
  id uuid primary key default gen_random_uuid(),
  turn_in_number text not null,
  name text not null default '',
  state text not null default '',
  turn_in_date date,
  benchmark_pct numeric(6, 2) not null default 75 check (benchmark_pct > 0),
  legacy_issue_id uuid references public.issues (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turn_ins_number_unique unique (turn_in_number)
);

create table if not exists public.turn_in_petition_columns (
  id uuid primary key default gen_random_uuid(),
  turn_in_id uuid not null references public.turn_ins (id) on delete cascade,
  priced_line_id uuid not null references public.priced_petition_lines (id) on delete restrict,
  sort_order integer not null default 0,
  benchmark_pct numeric(6, 2),
  created_at timestamptz not null default now(),
  constraint turn_in_petition_columns_unique unique (turn_in_id, priced_line_id)
);

create table if not exists public.turn_in_entries (
  id uuid primary key default gen_random_uuid(),
  turn_in_id uuid not null references public.turn_ins (id) on delete cascade,
  column_id uuid not null references public.turn_in_petition_columns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sigs integer not null default 0 check (sigs >= 0),
  books integer not null default 0 check (books >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turn_in_entries_unique unique (column_id, user_id)
);

create table if not exists public.turn_in_validity (
  id uuid primary key default gen_random_uuid(),
  turn_in_id uuid not null references public.turn_ins (id) on delete cascade,
  column_id uuid not null references public.turn_in_petition_columns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dups integer not null default 0 check (dups >= 0),
  usable integer not null default 0 check (usable >= 0),
  valid integer not null default 0 check (valid >= 0),
  failed integer not null default 0 check (failed >= 0),
  wrong_county integer not null default 0 check (wrong_county >= 0),
  processed_cn integer,
  deficient_n integer,
  disqualified_n integer,
  hard_match_n integer,
  soft_match_n integer,
  registration_n integer,
  non_match_n integer,
  validity_pct numeric(6, 2) not null default 0,
  entry_method public.validity_entry_method not null default 'manual',
  entered_by uuid references public.profiles (id) on delete set null,
  entered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turn_in_validity_unique unique (column_id, user_id)
);

create table if not exists public.ledger_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  turn_in_id uuid not null references public.turn_ins (id) on delete cascade,
  column_id uuid not null references public.turn_in_petition_columns (id) on delete cascade,
  sigs integer not null default 0,
  pay numeric(12, 4) not null default 0,
  estimated_pay numeric(12, 2) not null default 0,
  dups integer,
  usable integer,
  valid integer,
  validity_pct numeric(6, 2),
  pay_rate numeric(12, 6) not null default 0,
  payable integer,
  total_pay numeric(12, 2),
  upfront numeric(12, 2),
  hold numeric(12, 2),
  benchmark_pct numeric(6, 2) not null default 75,
  validity_pending boolean not null default true,
  recalculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_lines_unique unique (column_id, user_id)
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bucket public.payment_bucket not null,
  event_type public.payment_event_type not null default 'other',
  amount numeric(12, 2) not null default 0,
  notes text,
  receipt_path text,
  event_date date not null default current_date,
  paid_at timestamptz,
  funds_hit_at date,
  loan_id uuid references public.loan_requests (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lodging_properties (
  id uuid primary key default gen_random_uuid(),
  kind public.lodging_kind not null,
  name text not null,
  address text,
  daily_total numeric(12, 2),
  room_count integer,
  room_rate numeric(12, 2),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lodging_occupancies (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.lodging_properties (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  room_number text not null default '',
  occupants_in_room integer not null default 1 check (occupants_in_room >= 1),
  check_in_at timestamptz not null,
  check_out_at timestamptz,
  check_out_date date,
  check_out_backdated boolean not null default false,
  daily_amount numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expense_records
  add column if not exists tolls_amount numeric(12, 2) default 0 check (tolls_amount >= 0),
  add column if not exists lodging_occupancy_id uuid references public.lodging_occupancies (id) on delete set null,
  add column if not exists car_active boolean not null default false;

create table if not exists public.validity_name_map (
  id uuid primary key default gen_random_uuid(),
  initials text not null,
  ledger_name text not null,
  report_name text not null,
  created_at timestamptz not null default now(),
  constraint validity_name_map_initials_unique unique (initials)
);

create table if not exists public.login_otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null,
  channel text not null check (channel in ('email', 'sms')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists turn_in_entries_user_idx on public.turn_in_entries (user_id);
create index if not exists ledger_lines_user_idx on public.ledger_lines (user_id);
create index if not exists ledger_lines_turn_in_idx on public.ledger_lines (turn_in_id);
create index if not exists payment_events_user_idx on public.payment_events (user_id);
create index if not exists lodging_occupancies_open_idx on public.lodging_occupancies (property_id)
  where check_out_at is null and check_out_date is null;

insert into public.turn_ins (turn_in_number, name, state, turn_in_date, benchmark_pct, legacy_issue_id)
select
  i.issue_number,
  i.name,
  i.state,
  i.turn_in_date,
  coalesce((select (value #>> '{}')::numeric from public.app_config where key = 'benchmark_pct'), 75),
  i.id
from public.issues i
on conflict (turn_in_number) do nothing;

insert into public.turn_in_petition_columns (turn_in_id, priced_line_id, sort_order)
select t.id, pl.id, 0
from public.turn_ins t
join public.issues i on i.id = t.legacy_issue_id
join public.priced_petition_lines pl on pl.petition_id = i.petition_id
on conflict do nothing;

create or replace function private.pay_for_user(p_user_id uuid, p_priced_line_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text;
  v_pay numeric;
  v_lotus numeric;
begin
  select sa.code, pl.pay, pl.lotus_pay
  into v_code, v_pay, v_lotus
  from public.profiles p
  join public.sub_accounts sa on sa.id = p.sub_account_id
  join public.priced_petition_lines pl on pl.id = p_priced_line_id
  where p.id = p_user_id;

  if v_code = 'LOTUS' then
    return coalesce(v_lotus, v_pay, 0);
  end if;
  return coalesce(v_pay, 0);
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

create or replace function public.upsert_turn_in_entry(
  p_column_id uuid,
  p_user_id uuid,
  p_sigs integer,
  p_books integer
)
returns public.turn_in_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.turn_in_entries;
begin
  if not private.is_admin_plus() and auth.uid() <> p_user_id then
    raise exception 'Not authorized';
  end if;
  if not private.is_admin_plus() and private.current_role() not in (
    'petitioner', 'canvasser', 'team_lead', 'account_admin', 'super_admin'
  ) then
    raise exception 'Not authorized';
  end if;

  insert into public.turn_in_entries (turn_in_id, column_id, user_id, sigs, books)
  select c.turn_in_id, p_column_id, p_user_id, greatest(coalesce(p_sigs, 0), 0), greatest(coalesce(p_books, 0), 0)
  from public.turn_in_petition_columns c
  where c.id = p_column_id
  on conflict (column_id, user_id) do update set
    sigs = excluded.sigs,
    books = excluded.books,
    updated_at = now()
  returning * into v_row;

  perform private.recalculate_ledger_line(p_column_id, p_user_id);
  return v_row;
end;
$$;

create or replace function public.upsert_turn_in_validity(
  p_column_id uuid,
  p_user_id uuid,
  p_dups integer,
  p_usable integer,
  p_valid integer,
  p_failed integer default 0,
  p_wrong_county integer default 0
)
returns public.ledger_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pct numeric(6, 2);
begin
  if not (
    private.is_admin_plus()
    or private.current_role() = 'validator'
  ) then
    raise exception 'Not authorized';
  end if;

  v_pct := case
    when coalesce(p_usable, 0) = 0 then 0
    else round((p_valid::numeric / p_usable::numeric) * 100, 2)
  end;

  insert into public.turn_in_validity (
    turn_in_id, column_id, user_id, dups, usable, valid, failed, wrong_county,
    validity_pct, entry_method, entered_by, entered_at
  )
  select c.turn_in_id, p_column_id, p_user_id,
    greatest(coalesce(p_dups, 0), 0),
    greatest(coalesce(p_usable, 0), 0),
    greatest(coalesce(p_valid, 0), 0),
    greatest(coalesce(p_failed, 0), 0),
    greatest(coalesce(p_wrong_county, 0), 0),
    v_pct, 'manual', auth.uid(), now()
  from public.turn_in_petition_columns c
  where c.id = p_column_id
  on conflict (column_id, user_id) do update set
    dups = excluded.dups,
    usable = excluded.usable,
    valid = excluded.valid,
    failed = excluded.failed,
    wrong_county = excluded.wrong_county,
    validity_pct = excluded.validity_pct,
    entry_method = excluded.entry_method,
    entered_by = excluded.entered_by,
    entered_at = excluded.entered_at,
    updated_at = now();

  return private.recalculate_ledger_line(p_column_id, p_user_id);
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
  if not private.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  if p_event_type in ('advances', 'flight_advance', 'onpay', 'paid')
     and (p_receipt_path is null or trim(p_receipt_path) = '') then
    raise exception 'Receipt is required for this payment type';
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

create or replace function public.offboard_user(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.profiles;
begin
  if not private.is_super_admin() then
    raise exception 'Not authorized';
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

create or replace function public.lookup_user_for_login(p_identifier text)
returns table (
  user_id uuid,
  email text,
  phone text,
  employee_id text,
  status public.user_status
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select p.id, p.email, p.phone, p.employee_id, p.status
  from public.profiles p
  where lower(p.email) = lower(trim(p_identifier))
     or p.employee_id = trim(p_identifier)
  limit 1;
end;
$$;

alter table public.sub_accounts enable row level security;
alter table public.priced_petition_lines enable row level security;
alter table public.turn_ins enable row level security;
alter table public.turn_in_petition_columns enable row level security;
alter table public.turn_in_entries enable row level security;
alter table public.turn_in_validity enable row level security;
alter table public.ledger_lines enable row level security;
alter table public.payment_events enable row level security;
alter table public.lodging_properties enable row level security;
alter table public.lodging_occupancies enable row level security;
alter table public.validity_name_map enable row level security;

create policy sub_accounts_select on public.sub_accounts
for select to authenticated using (true);

create policy sub_accounts_admin on public.sub_accounts
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

create policy priced_lines_select on public.priced_petition_lines
for select to authenticated using (true);

create policy priced_lines_admin on public.priced_petition_lines
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

create policy turn_ins_select on public.turn_ins
for select to authenticated using (true);

create policy turn_ins_admin on public.turn_ins
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

create policy turn_in_cols_select on public.turn_in_petition_columns
for select to authenticated using (true);

create policy turn_in_cols_admin on public.turn_in_petition_columns
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

create policy turn_in_entries_select on public.turn_in_entries
for select to authenticated
using (private.can_view_user(user_id) or private.current_role() = 'validator');

create policy turn_in_entries_write on public.turn_in_entries
for all to authenticated
using (
  user_id = auth.uid()
  or private.is_admin_plus()
  or private.current_role() = 'team_lead'
)
with check (
  user_id = auth.uid()
  or private.is_admin_plus()
);

create policy turn_in_validity_select on public.turn_in_validity
for select to authenticated
using (private.can_view_user(user_id) or private.current_role() = 'validator');

create policy turn_in_validity_write on public.turn_in_validity
for all to authenticated
using (private.is_admin_plus() or private.current_role() = 'validator')
with check (private.is_admin_plus() or private.current_role() = 'validator');

create policy ledger_lines_select on public.ledger_lines
for select to authenticated
using (private.can_view_user(user_id));

create policy payment_events_select on public.payment_events
for select to authenticated
using (user_id = auth.uid() or private.is_admin_plus());

create policy payment_events_admin on public.payment_events
for all to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy lodging_props_select on public.lodging_properties
for select to authenticated using (true);

create policy lodging_props_admin on public.lodging_properties
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

create policy lodging_occ_select on public.lodging_occupancies
for select to authenticated
using (user_id = auth.uid() or private.is_admin_plus());

create policy lodging_occ_write on public.lodging_occupancies
for all to authenticated
using (user_id = auth.uid() or private.is_admin_plus())
with check (user_id = auth.uid() or private.is_admin_plus());

create policy validity_name_map_select on public.validity_name_map
for select to authenticated using (true);

create policy validity_name_map_admin on public.validity_name_map
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

grant select on public.sub_accounts to authenticated;
grant select on public.priced_petition_lines to authenticated;
grant select on public.turn_ins to authenticated;
grant select on public.turn_in_petition_columns to authenticated;
grant select on public.turn_in_entries to authenticated;
grant select on public.turn_in_validity to authenticated;
grant select on public.ledger_lines to authenticated;
grant select on public.payment_events to authenticated;
grant select on public.lodging_properties to authenticated;
grant select on public.lodging_occupancies to authenticated;
grant select on public.validity_name_map to authenticated;

grant execute on function private.pay_for_user(uuid, uuid) to authenticated;
grant execute on function private.recalculate_ledger_line(uuid, uuid) to authenticated;
grant execute on function public.upsert_turn_in_entry(uuid, uuid, integer, integer) to authenticated;
grant execute on function public.upsert_turn_in_validity(uuid, uuid, integer, integer, integer, integer, integer) to authenticated;
grant execute on function public.create_payment_event(uuid, public.payment_bucket, public.payment_event_type, numeric, text, text, date, date, uuid) to authenticated;
grant execute on function public.offboard_user(uuid) to authenticated;
grant execute on function public.lookup_user_for_login(text) to anon, authenticated;

with numbered as (
  select id, row_number() over (order by created_at, email) as n
  from public.profiles
  where employee_id is null
)
update public.profiles p
set employee_id = 'BAP-' || lpad(numbered.n::text, 6, '0')
from numbered
where p.id = numbered.id;

drop function if exists public.create_expense(
  public.expense_type, numeric, date, date, uuid, text, uuid
);

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

grant execute on function public.create_expense(
  public.expense_type, numeric, date, date, uuid, text, uuid, numeric, boolean
) to authenticated;

grant insert, update, delete on public.sub_accounts to authenticated;
grant insert, update, delete on public.priced_petition_lines to authenticated;
grant insert, update, delete on public.turn_ins to authenticated;
grant insert, update, delete on public.turn_in_petition_columns to authenticated;
grant insert, update, delete on public.turn_in_entries to authenticated;
grant insert, update, delete on public.turn_in_validity to authenticated;
grant insert, update, delete on public.ledger_lines to authenticated;
grant insert, update, delete on public.payment_events to authenticated;
grant insert, update, delete on public.lodging_properties to authenticated;
grant insert, update, delete on public.lodging_occupancies to authenticated;
grant insert, update, delete on public.validity_name_map to authenticated;
grant update (tolls_amount, car_active, updated_at) on public.expense_records to authenticated;

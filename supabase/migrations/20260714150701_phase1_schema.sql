create extension if not exists "pgcrypto";

create schema if not exists private;

create type public.user_role as enum (
  'super_admin',
  'account_admin',
  'team_lead',
  'petitioner',
  'canvasser',
  'validator'
);

create type public.user_status as enum ('active', 'inactive');
create type public.wage_currency as enum ('USD', 'PHP');
create type public.pay_model as enum ('validity_standard', 'per_valid_sig');
create type public.expense_type as enum (
  'upfront_draw',
  'chargeback',
  'hotel_travel',
  'health',
  'car_rental',
  'housing',
  'other'
);
create type public.expense_config_type as enum ('standard', 'per_issue');
create type public.loan_status as enum ('pending', 'approved', 'rejected', 'auto_rejected');
create type public.payroll_record_status as enum ('draft', 'locked');
create type public.validity_entry_method as enum ('upload', 'manual');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  initials text not null,
  email text not null,
  role public.user_role not null,
  status public.user_status not null default 'active',
  wage_currency public.wage_currency,
  hourly_wage numeric(12, 2),
  profile_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_unique unique (email),
  constraint profiles_initials_unique unique (initials)
);

create table public.team_memberships (
  lead_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, member_id),
  constraint team_memberships_no_self check (lead_id <> member_id)
);

create table public.role_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_categories_name_unique unique (name)
);

create table public.role_category_members (
  category_id uuid not null references public.role_categories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (category_id, user_id)
);

create table public.petitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  pay numeric(12, 4) not null default 0,
  lotus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint petitions_code_unique unique (code)
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  issue_number text not null,
  name text not null,
  petition_id uuid not null references public.petitions (id) on delete restrict,
  state text not null,
  validated_by text,
  turn_in_date date,
  turn_in_number text,
  business_logo_path text,
  pay_model public.pay_model not null default 'validity_standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint issues_issue_number_unique unique (issue_number)
);

create table public.pay_rate_configs (
  id uuid primary key default gen_random_uuid(),
  petition_id uuid not null references public.petitions (id) on delete cascade,
  issue_id uuid not null references public.issues (id) on delete cascade,
  pay_rate numeric(12, 4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_rate_configs_petition_issue_unique unique (petition_id, issue_id)
);

create table public.submission_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  issue_id uuid not null references public.issues (id) on delete cascade,
  raw_signatures integer not null default 0 check (raw_signatures >= 0),
  page_numbers integer not null default 0 check (page_numbers >= 0),
  pooled_signatures integer not null default 0 check (pooled_signatures >= 0),
  pooled_pages integer not null default 0 check (pooled_pages >= 0),
  last_edited_by uuid references public.profiles (id) on delete set null,
  last_edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submission_records_user_issue_unique unique (user_id, issue_id)
);

create table public.validity_records (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dups integer not null default 0 check (dups >= 0),
  usable integer not null default 0 check (usable >= 0),
  valid integer not null default 0 check (valid >= 0),
  validity_pct numeric(6, 2) not null check (validity_pct >= 0),
  entry_method public.validity_entry_method not null,
  entered_by uuid references public.profiles (id) on delete set null,
  entered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint validity_records_user_issue_unique unique (user_id, issue_id)
);

create table public.ledger_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  issue_id uuid not null references public.issues (id) on delete cascade,
  sigs integer not null default 0,
  pay numeric(12, 4) not null default 0,
  estimated_pay numeric(12, 2) not null default 0,
  dups integer,
  usable integer,
  valid integer,
  validity_pct numeric(6, 2),
  pay_rate numeric(12, 4) not null default 0,
  payable integer,
  total_pay numeric(12, 2),
  upfront numeric(12, 2),
  hold numeric(12, 2),
  pay_model public.pay_model not null,
  validity_pending boolean not null default true,
  recalculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_rows_user_issue_unique unique (user_id, issue_id)
);

create table public.expense_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  issue_id uuid references public.issues (id) on delete set null,
  type public.expense_type not null,
  amount numeric(12, 2) not null check (amount >= 0),
  receipt_path text,
  expense_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_records_end_date_ok check (end_date is null or end_date >= expense_date)
);

create table public.car_rental_configs (
  id uuid primary key default gen_random_uuid(),
  config_type public.expense_config_type not null,
  rate numeric(12, 2) not null default 0 check (rate >= 0),
  issue_id uuid references public.issues (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint car_rental_configs_standard_or_issue check (
    (config_type = 'standard' and issue_id is null)
    or (config_type = 'per_issue' and issue_id is not null)
  )
);

create unique index car_rental_configs_standard_unique
  on public.car_rental_configs ((true))
  where config_type = 'standard';

create unique index car_rental_configs_issue_unique
  on public.car_rental_configs (issue_id)
  where config_type = 'per_issue';

create table public.housing_configs (
  id uuid primary key default gen_random_uuid(),
  config_type public.expense_config_type not null,
  rate numeric(12, 2) not null default 0 check (rate >= 0),
  issue_id uuid references public.issues (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint housing_configs_standard_or_issue check (
    (config_type = 'standard' and issue_id is null)
    or (config_type = 'per_issue' and issue_id is not null)
  )
);

create unique index housing_configs_standard_unique
  on public.housing_configs ((true))
  where config_type = 'standard';

create unique index housing_configs_issue_unique
  on public.housing_configs (issue_id)
  where config_type = 'per_issue';

create table public.loan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_requested numeric(12, 2) not null check (amount_requested > 0),
  hold_balance_snapshot numeric(12, 2) not null,
  note text,
  status public.loan_status not null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monthly_payroll_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null check (year >= 2000),
  total_pay numeric(12, 2) not null default 0,
  total_expenses numeric(12, 2) not null default 0,
  net_payable numeric(12, 2) not null default 0,
  upfront_paid numeric(12, 2) not null default 0,
  hold_balance numeric(12, 2) not null default 0,
  generated_by uuid references public.profiles (id) on delete set null,
  generated_on timestamptz not null default now(),
  status public.payroll_record_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_payroll_records_user_period_unique unique (user_id, month, year)
);

create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.app_config (key, value)
values ('benchmark_pct', '75'::jsonb);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger role_categories_set_updated_at before update on public.role_categories
for each row execute function private.set_updated_at();
create trigger petitions_set_updated_at before update on public.petitions
for each row execute function private.set_updated_at();
create trigger issues_set_updated_at before update on public.issues
for each row execute function private.set_updated_at();
create trigger pay_rate_configs_set_updated_at before update on public.pay_rate_configs
for each row execute function private.set_updated_at();
create trigger submission_records_set_updated_at before update on public.submission_records
for each row execute function private.set_updated_at();
create trigger validity_records_set_updated_at before update on public.validity_records
for each row execute function private.set_updated_at();
create trigger ledger_rows_set_updated_at before update on public.ledger_rows
for each row execute function private.set_updated_at();
create trigger expense_records_set_updated_at before update on public.expense_records
for each row execute function private.set_updated_at();
create trigger car_rental_configs_set_updated_at before update on public.car_rental_configs
for each row execute function private.set_updated_at();
create trigger housing_configs_set_updated_at before update on public.housing_configs
for each row execute function private.set_updated_at();
create trigger loan_requests_set_updated_at before update on public.loan_requests
for each row execute function private.set_updated_at();
create trigger monthly_payroll_records_set_updated_at before update on public.monthly_payroll_records
for each row execute function private.set_updated_at();
create trigger app_config_set_updated_at before update on public.app_config
for each row execute function private.set_updated_at();

create or replace function private.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function private.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and status = 'active'
  );
$$;

create or replace function private.is_admin_plus()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('super_admin', 'account_admin')
      and status = 'active'
  );
$$;

create or replace function private.can_view_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target = auth.uid()
    or private.is_admin_plus()
    or exists (
      select 1 from public.team_memberships tm
      join public.profiles lead on lead.id = tm.lead_id
      where tm.lead_id = auth.uid()
        and tm.member_id = target
        and lead.role = 'team_lead'
        and lead.status = 'active'
    );
$$;

alter table public.profiles enable row level security;
alter table public.team_memberships enable row level security;
alter table public.role_categories enable row level security;
alter table public.role_category_members enable row level security;
alter table public.petitions enable row level security;
alter table public.issues enable row level security;
alter table public.pay_rate_configs enable row level security;
alter table public.submission_records enable row level security;
alter table public.validity_records enable row level security;
alter table public.ledger_rows enable row level security;
alter table public.expense_records enable row level security;
alter table public.car_rental_configs enable row level security;
alter table public.housing_configs enable row level security;
alter table public.loan_requests enable row level security;
alter table public.monthly_payroll_records enable row level security;
alter table public.app_config enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or private.is_admin_plus()
  or private.can_view_user(id)
);

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
for all to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy team_memberships_select on public.team_memberships
for select to authenticated
using (lead_id = auth.uid() or member_id = auth.uid() or private.is_admin_plus());

create policy team_memberships_admin on public.team_memberships
for all to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy role_categories_select on public.role_categories
for select to authenticated
using (true);

create policy role_categories_admin on public.role_categories
for all to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy role_category_members_select on public.role_category_members
for select to authenticated
using (true);

create policy role_category_members_admin on public.role_category_members
for all to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy petitions_select on public.petitions
for select to authenticated
using (true);

create policy petitions_write on public.petitions
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

create policy issues_select on public.issues
for select to authenticated
using (true);

create policy issues_write on public.issues
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

create policy pay_rate_configs_select on public.pay_rate_configs
for select to authenticated
using (true);

create policy pay_rate_configs_write on public.pay_rate_configs
for all to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy submission_records_select on public.submission_records
for select to authenticated
using (private.can_view_user(user_id) or private.current_role() = 'validator');

create policy submission_records_insert on public.submission_records
for insert to authenticated
with check (
  user_id = auth.uid()
  or private.is_admin_plus()
  or private.current_role() = 'team_lead'
);

create policy submission_records_update on public.submission_records
for update to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

create policy validity_records_select on public.validity_records
for select to authenticated
using (private.can_view_user(user_id) or private.current_role() = 'validator');

create policy validity_records_write on public.validity_records
for all to authenticated
using (
  private.is_admin_plus()
  or private.current_role() = 'validator'
)
with check (
  private.is_admin_plus()
  or private.current_role() = 'validator'
);

create policy ledger_rows_select on public.ledger_rows
for select to authenticated
using (private.can_view_user(user_id));

create policy expense_records_select on public.expense_records
for select to authenticated
using (private.can_view_user(user_id));

create policy expense_records_insert on public.expense_records
for insert to authenticated
with check (user_id = auth.uid() or private.is_admin_plus());

create policy car_rental_configs_select on public.car_rental_configs
for select to authenticated
using (true);

create policy car_rental_configs_write on public.car_rental_configs
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

create policy housing_configs_select on public.housing_configs
for select to authenticated
using (true);

create policy housing_configs_write on public.housing_configs
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

create policy loan_requests_select on public.loan_requests
for select to authenticated
using (user_id = auth.uid() or private.is_super_admin());

create policy loan_requests_insert on public.loan_requests
for insert to authenticated
with check (
  user_id = auth.uid()
  and private.current_role() in ('petitioner', 'canvasser')
);

create policy loan_requests_update on public.loan_requests
for update to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy monthly_payroll_select on public.monthly_payroll_records
for select to authenticated
using (private.can_view_user(user_id));

create policy monthly_payroll_write on public.monthly_payroll_records
for all to authenticated
using (private.is_admin_plus())
with check (private.is_admin_plus());

create policy app_config_select on public.app_config
for select to authenticated
using (true);

create policy app_config_write on public.app_config
for all to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

revoke all on schema private from public;
grant usage on schema private to postgres, service_role, authenticated;
grant execute on function private.current_profile() to authenticated;
grant execute on function private.current_role() to authenticated;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.is_admin_plus() to authenticated;
grant execute on function private.can_view_user(uuid) to authenticated;

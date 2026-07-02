create extension if not exists "pgcrypto";

create type public.user_role as enum ('circulator', 'admin', 'super_admin');
create type public.circulator_status as enum ('active', 'inactive');
create type public.expense_type as enum ('draw', 'chargeback', 'hotel_travel', 'other');
create type public.loan_status as enum ('pending', 'approved', 'rejected', 'auto_rejected');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'circulator',
  circulator_id uuid,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.circulators (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  initials text not null,
  status public.circulator_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint circulators_initials_unique unique (initials)
);

alter table public.profiles
  add constraint profiles_circulator_id_fkey
  foreign key (circulator_id) references public.circulators (id) on delete set null;

create table public.petitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  pay numeric(12, 2) not null default 0,
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
  state_code text not null,
  validated_by text,
  turn_in_date date,
  turn_in_number text,
  business_logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint issues_issue_number_unique unique (issue_number)
);

create table public.submission_records (
  id uuid primary key default gen_random_uuid(),
  circulator_id uuid not null references public.circulators (id) on delete cascade,
  issue_id uuid not null references public.issues (id) on delete cascade,
  raw_signatures integer not null default 0 check (raw_signatures >= 0),
  page_numbers integer not null default 0 check (page_numbers >= 0),
  pooled_signatures integer not null default 0 check (pooled_signatures >= 0),
  pooled_pages integer not null default 0 check (pooled_pages >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submission_records_circulator_issue_unique unique (circulator_id, issue_id)
);

create table public.pay_rates (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  rate numeric(12, 2) not null default 1.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_rates_issue_unique unique (issue_id)
);

create table public.app_settings (
  id boolean primary key default true check (id = true),
  benchmark_percent numeric(5, 2) not null default 75.00,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.app_settings (id, benchmark_percent) values (true, 75.00);

create table public.validity_uploads (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references auth.users (id) on delete set null,
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.validity_records (
  id uuid primary key default gen_random_uuid(),
  circulator_id uuid not null references public.circulators (id) on delete cascade,
  issue_id uuid not null references public.issues (id) on delete cascade,
  upload_id uuid references public.validity_uploads (id) on delete set null,
  dups integer not null default 0,
  usable integer not null default 0,
  valid_count integer not null default 0,
  validity_percent numeric(5, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint validity_records_circulator_issue_unique unique (circulator_id, issue_id)
);

create table public.ledger_rows (
  id uuid primary key default gen_random_uuid(),
  circulator_id uuid not null references public.circulators (id) on delete cascade,
  issue_id uuid not null references public.issues (id) on delete cascade,
  sigs integer not null default 0,
  pay numeric(12, 2) not null default 0,
  estimated_pay numeric(12, 2) not null default 0,
  dups integer,
  usable integer,
  valid_count integer,
  validity_percent numeric(5, 2),
  pay_rate numeric(12, 2) not null default 1.00,
  payable integer,
  total_pay numeric(12, 2),
  upfront numeric(12, 2),
  hold numeric(12, 2),
  validity_pending boolean not null default true,
  calculated_at timestamptz not null default now(),
  constraint ledger_rows_circulator_issue_unique unique (circulator_id, issue_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  circulator_id uuid not null references public.circulators (id) on delete cascade,
  expense_type public.expense_type not null,
  amount numeric(12, 2) not null check (amount >= 0),
  receipt_path text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.loan_requests (
  id uuid primary key default gen_random_uuid(),
  circulator_id uuid not null references public.circulators (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  hold_snapshot numeric(12, 2) not null,
  status public.loan_status not null default 'pending',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.hold_disbursements (
  id uuid primary key default gen_random_uuid(),
  loan_request_id uuid not null references public.loan_requests (id) on delete cascade,
  circulator_id uuid not null references public.circulators (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint hold_disbursements_loan_unique unique (loan_request_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text,
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'super_admin') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.own_circulator_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select circulator_id from public.profiles where id = auth.uid();
$$;

create or replace function public.calculate_payable(
  sigs integer,
  validity_percent numeric,
  benchmark_percent numeric
)
returns integer
language plpgsql
immutable
as $$
declare
  shortfall numeric;
begin
  if validity_percent is null then
    return null;
  end if;

  if validity_percent >= benchmark_percent then
    return sigs;
  end if;

  shortfall := benchmark_percent - validity_percent;
  return round(sigs * (1 - shortfall / 100.0));
end;
$$;

create or replace function public.recalculate_ledger_for_issue(p_issue_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  benchmark numeric(5, 2);
begin
  select benchmark_percent into benchmark from public.app_settings where id = true;

  insert into public.ledger_rows (
    circulator_id,
    issue_id,
    sigs,
    pay,
    estimated_pay,
    dups,
    usable,
    valid_count,
    validity_percent,
    pay_rate,
    payable,
    total_pay,
    upfront,
    hold,
    validity_pending,
    calculated_at
  )
  select
    sr.circulator_id,
    sr.issue_id,
    sr.raw_signatures as sigs,
    p.pay,
    round(sr.raw_signatures * p.pay, 2) as estimated_pay,
    vr.dups,
    vr.usable,
    vr.valid_count,
    vr.validity_percent,
    coalesce(pr.rate, 1.00) as pay_rate,
    public.calculate_payable(sr.raw_signatures, vr.validity_percent, benchmark) as payable,
    case
      when vr.validity_percent is null then null
      else round(
        p.pay
        * public.calculate_payable(sr.raw_signatures, vr.validity_percent, benchmark)
        * coalesce(pr.rate, 1.00),
        2
      )
    end as total_pay,
    case
      when vr.validity_percent is null then null
      else round(
        p.pay
        * public.calculate_payable(sr.raw_signatures, vr.validity_percent, benchmark)
        * coalesce(pr.rate, 1.00)
        * 0.85,
        2
      )
    end as upfront,
    case
      when vr.validity_percent is null then null
      else round(
        p.pay
        * public.calculate_payable(sr.raw_signatures, vr.validity_percent, benchmark)
        * coalesce(pr.rate, 1.00)
        * 0.15,
        2
      )
    end as hold,
    vr.validity_percent is null as validity_pending,
    now() as calculated_at
  from public.submission_records sr
  join public.issues i on i.id = sr.issue_id
  join public.petitions p on p.id = i.petition_id
  left join public.pay_rates pr on pr.issue_id = sr.issue_id
  left join public.validity_records vr
    on vr.circulator_id = sr.circulator_id
    and vr.issue_id = sr.issue_id
  where sr.issue_id = p_issue_id
  on conflict (circulator_id, issue_id) do update set
    sigs = excluded.sigs,
    pay = excluded.pay,
    estimated_pay = excluded.estimated_pay,
    dups = excluded.dups,
    usable = excluded.usable,
    valid_count = excluded.valid_count,
    validity_percent = excluded.validity_percent,
    pay_rate = excluded.pay_rate,
    payable = excluded.payable,
    total_pay = excluded.total_pay,
    upfront = excluded.upfront,
    hold = excluded.hold,
    validity_pending = excluded.validity_pending,
    calculated_at = excluded.calculated_at;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'circulator',
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.circulators enable row level security;
alter table public.petitions enable row level security;
alter table public.issues enable row level security;
alter table public.submission_records enable row level security;
alter table public.pay_rates enable row level security;
alter table public.app_settings enable row level security;
alter table public.validity_uploads enable row level security;
alter table public.validity_records enable row level security;
alter table public.ledger_rows enable row level security;
alter table public.expenses enable row level security;
alter table public.loan_requests enable row level security;
alter table public.hold_disbursements enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin_or_above());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

create policy circulators_select on public.circulators
  for select to authenticated
  using (public.is_admin_or_above() or id = public.own_circulator_id());

create policy circulators_admin_write on public.circulators
  for all to authenticated
  using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

create policy petitions_read on public.petitions
  for select to authenticated
  using (true);

create policy petitions_super_admin_write on public.petitions
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy issues_read on public.issues
  for select to authenticated
  using (true);

create policy issues_admin_write on public.issues
  for all to authenticated
  using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

create policy submissions_select on public.submission_records
  for select to authenticated
  using (
    public.is_admin_or_above()
    or circulator_id = public.own_circulator_id()
  );

create policy submissions_insert_own on public.submission_records
  for insert to authenticated
  with check (
    circulator_id = public.own_circulator_id()
    and exists (
      select 1 from public.circulators c
      where c.id = circulator_id and c.status = 'active'
    )
  );

create policy submissions_update on public.submission_records
  for update to authenticated
  using (
    public.is_admin_or_above()
    or circulator_id = public.own_circulator_id()
  )
  with check (
    public.is_admin_or_above()
    or circulator_id = public.own_circulator_id()
  );

create policy pay_rates_read on public.pay_rates
  for select to authenticated
  using (true);

create policy pay_rates_super_admin_write on public.pay_rates
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy app_settings_read on public.app_settings
  for select to authenticated
  using (true);

create policy app_settings_super_admin_write on public.app_settings
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy validity_uploads_admin on public.validity_uploads
  for all to authenticated
  using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

create policy validity_records_read on public.validity_records
  for select to authenticated
  using (
    public.is_admin_or_above()
    or circulator_id = public.own_circulator_id()
  );

create policy validity_records_admin_write on public.validity_records
  for all to authenticated
  using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

create policy ledger_select on public.ledger_rows
  for select to authenticated
  using (
    public.is_admin_or_above()
    or circulator_id = public.own_circulator_id()
  );

create policy expenses_select on public.expenses
  for select to authenticated
  using (
    public.is_admin_or_above()
    or circulator_id = public.own_circulator_id()
  );

create policy expenses_insert_own on public.expenses
  for insert to authenticated
  with check (
    circulator_id = public.own_circulator_id()
    and exists (
      select 1 from public.circulators c
      where c.id = circulator_id and c.status = 'active'
    )
  );

create policy loan_requests_select on public.loan_requests
  for select to authenticated
  using (
    public.is_super_admin()
    or circulator_id = public.own_circulator_id()
  );

create policy loan_requests_insert_own on public.loan_requests
  for insert to authenticated
  with check (circulator_id = public.own_circulator_id());

create policy loan_requests_super_admin_update on public.loan_requests
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy hold_disbursements_read on public.hold_disbursements
  for select to authenticated
  using (
    public.is_admin_or_above()
    or circulator_id = public.own_circulator_id()
  );

create policy hold_disbursements_super_admin_write on public.hold_disbursements
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy audit_events_admin_read on public.audit_events
  for select to authenticated
  using (public.is_admin_or_above());

create policy audit_events_insert on public.audit_events
  for insert to authenticated
  with check (public.is_admin_or_above() or public.is_super_admin());

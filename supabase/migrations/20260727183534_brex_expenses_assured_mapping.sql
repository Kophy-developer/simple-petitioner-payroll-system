alter table public.profiles
  add column if not exists brex_user_id text;

create unique index if not exists profiles_brex_user_id_unique
  on public.profiles (brex_user_id)
  where brex_user_id is not null;

alter table public.brex_transactions
  add column if not exists memo text,
  add column if not exists expense_status text,
  add column if not exists payment_status text,
  add column if not exists budget_id text,
  add column if not exists budget_name text,
  add column if not exists assigned_to text,
  add column if not exists brex_user_id text,
  add column if not exists brex_user_email text,
  add column if not exists has_receipts boolean not null default false,
  add column if not exists receipt_count integer not null default 0,
  add column if not exists card_id text,
  add column if not exists card_last_four text,
  add column if not exists card_transaction_reference_id text,
  add column if not exists merchant_raw text,
  add column if not exists match_method text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'brex_transactions_match_method_check'
  ) then
    alter table public.brex_transactions
      add constraint brex_transactions_match_method_check
      check (
        match_method is null
        or match_method in ('email', 'card_owner_email', 'brex_user_id')
      );
  end if;
end $$;

create index if not exists brex_transactions_match_method_idx
  on public.brex_transactions (match_method);

create index if not exists brex_transactions_brex_user_id_idx
  on public.brex_transactions (brex_user_id);

alter table public.brex_transactions
  add column if not exists match_confidence numeric(4, 3),
  add column if not exists disputed_at timestamptz,
  add column if not exists dispute_note text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'brex_transactions_match_method_check'
  ) then
    alter table public.brex_transactions
      drop constraint brex_transactions_match_method_check;
  end if;
end $$;

alter table public.brex_transactions
  add constraint brex_transactions_match_method_check
  check (
    match_method is null
    or match_method in (
      'email',
      'card_owner_email',
      'brex_user_id',
      'name_exact',
      'name_similar'
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'brex_transactions_match_confidence_check'
  ) then
    alter table public.brex_transactions
      add constraint brex_transactions_match_confidence_check
      check (
        match_confidence is null
        or (match_confidence >= 0 and match_confidence <= 1)
      );
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'brex_transactions_reimbursement_status_check'
  ) then
    alter table public.brex_transactions
      drop constraint brex_transactions_reimbursement_status_check;
  end if;
end $$;

alter table public.brex_transactions
  add constraint brex_transactions_reimbursement_status_check
  check (
    reimbursement_status in ('none', 'pending', 'approved', 'rejected', 'disputed')
  );

create index if not exists brex_transactions_disputed_at_idx
  on public.brex_transactions (disputed_at)
  where disputed_at is not null;

create or replace function public.mark_brex_for_reimbursement(p_brex_id uuid)
returns public.brex_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.brex_transactions;
begin
  select * into v_row from public.brex_transactions where id = p_brex_id;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_row.matched_user_id <> auth.uid() and not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;
  if v_row.disputed_at is not null or v_row.reimbursement_status = 'disputed' then
    raise exception 'Disputed transactions cannot be marked for reimbursement';
  end if;
  if v_row.reimbursement_status = 'approved' then
    raise exception 'Transaction already approved';
  end if;

  update public.brex_transactions
  set
    reimbursement_requested = true,
    reimbursement_requested_by = auth.uid(),
    reimbursement_requested_at = now(),
    reimbursement_status = 'pending',
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
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  select * into v_row from public.brex_transactions where id = p_brex_id;
  if not found then
    raise exception 'Transaction not found';
  end if;

  if v_row.disputed_at is not null or v_row.reimbursement_status = 'disputed' then
    raise exception 'Resolve the dispute before reviewing reimbursement';
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
  );

  update public.brex_transactions
  set
    reimbursement_status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_brex_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.dispute_brex_transaction(
  p_brex_id uuid,
  p_note text default null
)
returns public.brex_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.brex_transactions;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into v_row from public.brex_transactions where id = p_brex_id;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_row.matched_user_id is null then
    raise exception 'Transaction is not matched';
  end if;
  if v_row.matched_user_id <> auth.uid() and not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;
  if v_row.reimbursement_status = 'approved' then
    raise exception 'Approved transactions cannot be disputed';
  end if;
  if v_row.disputed_at is not null or v_row.reimbursement_status = 'disputed' then
    raise exception 'Transaction is already disputed';
  end if;

  update public.brex_transactions
  set
    disputed_at = now(),
    dispute_note = v_note,
    reimbursement_status = 'disputed',
    reimbursement_requested = false,
    updated_at = now()
  where id = p_brex_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.resolve_brex_dispute(
  p_brex_id uuid,
  p_confirm boolean
)
returns public.brex_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.brex_transactions;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  select * into v_row from public.brex_transactions where id = p_brex_id;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_row.disputed_at is null and v_row.reimbursement_status <> 'disputed' then
    raise exception 'Transaction is not disputed';
  end if;

  if p_confirm then
    update public.brex_transactions
    set
      disputed_at = null,
      dispute_note = null,
      reimbursement_status = 'none',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    where id = p_brex_id
    returning * into v_row;
  else
    update public.brex_transactions
    set
      matched_user_id = null,
      match_method = null,
      match_confidence = null,
      disputed_at = null,
      dispute_note = null,
      reimbursement_requested = false,
      reimbursement_requested_by = null,
      reimbursement_requested_at = null,
      reimbursement_status = 'none',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    where id = p_brex_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.dispute_brex_transaction(uuid, text) to authenticated;
grant execute on function public.resolve_brex_dispute(uuid, boolean) to authenticated;

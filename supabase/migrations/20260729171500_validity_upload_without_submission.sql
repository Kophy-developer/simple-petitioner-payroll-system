create or replace function public.apply_validity_upload(
  p_issue_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item jsonb;
  v_user_id uuid;
  v_dups integer;
  v_usable integer;
  v_valid integer;
  v_pct numeric;
  v_count integer := 0;
begin
  if not (
    private.is_admin_plus()
    or private.current_role() = 'validator'
  ) then
    raise exception 'Not authorized';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows must be a JSON array';
  end if;

  if not exists (select 1 from public.issues where id = p_issue_id) then
    raise exception 'Issue not found';
  end if;

  for v_item in select * from jsonb_array_elements(p_rows)
  loop
    v_user_id := nullif(v_item ->> 'user_id', '')::uuid;
    v_dups := coalesce(round(coalesce((v_item ->> 'dups')::numeric, 0))::integer, 0);
    v_usable := coalesce(round(coalesce((v_item ->> 'usable')::numeric, 0))::integer, 0);
    v_valid := coalesce(round(coalesce((v_item ->> 'valid')::numeric, 0))::integer, 0);
    v_pct := coalesce((v_item ->> 'validity_pct')::numeric, 0);

    if v_user_id is null then
      continue;
    end if;

    if v_dups < 0 or v_usable < 0 or v_valid < 0 or v_pct < 0 then
      raise exception 'Validity values must be zero or greater';
    end if;

    insert into public.validity_records (
      issue_id, user_id, dups, usable, valid, validity_pct, entry_method, entered_by, entered_at
    )
    values (
      p_issue_id, v_user_id, v_dups, v_usable, v_valid, v_pct, 'upload', auth.uid(), now()
    )
    on conflict (user_id, issue_id) do update set
      dups = excluded.dups,
      usable = excluded.usable,
      valid = excluded.valid,
      validity_pct = excluded.validity_pct,
      entry_method = 'upload',
      entered_by = auth.uid(),
      entered_at = now(),
      updated_at = now();

    if exists (
      select 1
      from public.submission_records
      where user_id = v_user_id and issue_id = p_issue_id
    ) then
      perform private.recalculate_ledger_row(v_user_id, p_issue_id);
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

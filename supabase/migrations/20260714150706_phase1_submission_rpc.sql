create or replace function public.create_submission(
  p_issue_id uuid,
  p_raw_signatures integer,
  p_page_numbers integer,
  p_pooled_signatures integer default null,
  p_pooled_pages integer default null
)
returns public.submission_records
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_role public.user_role;
  v_row public.submission_records;
  v_pooled_sigs integer := coalesce(p_pooled_signatures, p_raw_signatures);
  v_pooled_pages integer := coalesce(p_pooled_pages, p_page_numbers);
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role not in (
    'petitioner', 'canvasser', 'team_lead', 'account_admin', 'super_admin'
  ) then
    raise exception 'Not authorized';
  end if;

  if p_raw_signatures is null or p_raw_signatures < 0 or p_page_numbers is null or p_page_numbers < 0 then
    raise exception 'Signatures and pages must be zero or greater';
  end if;

  insert into public.submission_records (
    user_id,
    issue_id,
    raw_signatures,
    page_numbers,
    pooled_signatures,
    pooled_pages
  )
  values (
    auth.uid(),
    p_issue_id,
    p_raw_signatures,
    p_page_numbers,
    v_pooled_sigs,
    v_pooled_pages
  )
  on conflict (user_id, issue_id) do update set
    raw_signatures = excluded.raw_signatures,
    page_numbers = excluded.page_numbers,
    pooled_signatures = excluded.pooled_signatures,
    pooled_pages = excluded.pooled_pages,
    updated_at = now()
  returning * into v_row;

  perform private.recalculate_ledger_row(v_row.user_id, v_row.issue_id);
  return v_row;
end;
$fn$;

grant execute on function public.create_submission(uuid, integer, integer, integer, integer) to authenticated;

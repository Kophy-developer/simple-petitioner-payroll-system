create or replace function public.admin_set_team_members(
  p_lead_id uuid,
  p_member_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_lead_role public.user_role;
  v_invalid integer;
begin
  if not private.is_admin_plus() then
    raise exception 'Not authorized';
  end if;

  select role into v_lead_role from public.profiles where id = p_lead_id;

  if v_lead_role is null then
    raise exception 'Team lead not found';
  end if;

  if v_lead_role <> 'team_lead' then
    raise exception 'Selected user is not a team lead';
  end if;

  select count(*) into v_invalid
  from unnest(coalesce(p_member_ids, array[]::uuid[])) as m(id)
  left join public.profiles p on p.id = m.id
  where p.id is null
     or p.id = p_lead_id
     or p.role not in ('petitioner', 'canvasser', 'validator');

  if v_invalid > 0 then
    raise exception 'One or more selected members are invalid';
  end if;

  delete from public.team_memberships where lead_id = p_lead_id;

  insert into public.team_memberships (lead_id, member_id)
  select p_lead_id, m.id
  from unnest(coalesce(p_member_ids, array[]::uuid[])) as m(id)
  on conflict do nothing;
end;
$$;

grant execute on function public.admin_set_team_members(uuid, uuid[]) to authenticated;

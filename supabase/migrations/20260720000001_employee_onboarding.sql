alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists onboarding_complete boolean not null default true;

update public.profiles
set must_change_password = false,
    onboarding_complete = true
where true;

create sequence if not exists public.employee_id_seq
  as integer
  start with 10001
  increment by 1
  minvalue 10001
  maxvalue 99999
  no cycle;

do $$
declare
  v_max integer;
begin
  select max(employee_id::integer)
  into v_max
  from public.profiles
  where employee_id ~ '^[0-9]{5}$';

  if v_max is null then
    perform setval('public.employee_id_seq', 10001, false);
  else
    perform setval('public.employee_id_seq', greatest(v_max, 10001), true);
  end if;
end $$;

create or replace function public.next_employee_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  v_id := lpad(nextval('public.employee_id_seq')::text, 5, '0');
  if v_id::integer > 99999 then
    raise exception 'Employee ID space exhausted';
  end if;
  return v_id;
end;
$$;

create or replace function public.complete_password_change()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
begin
  update public.profiles
  set must_change_password = false,
      updated_at = now()
  where id = auth.uid()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.complete_onboarding_contact(
  p_email text,
  p_phone text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
  v_email text := lower(trim(p_email));
  v_phone text := trim(p_phone);
begin
  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email is required';
  end if;
  if v_phone is null or length(regexp_replace(v_phone, '[^0-9+]', '', 'g')) < 10 then
    raise exception 'A valid phone number is required';
  end if;

  if exists (
    select 1 from public.profiles
    where lower(email) = v_email and id <> auth.uid()
  ) then
    raise exception 'That email is already in use';
  end if;

  update public.profiles
  set email = v_email,
      phone = v_phone,
      onboarding_complete = true,
      updated_at = now()
  where id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.next_employee_id() to service_role;
grant execute on function public.complete_password_change() to authenticated;
grant execute on function public.complete_onboarding_contact(text, text) to authenticated;

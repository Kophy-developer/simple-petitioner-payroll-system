create or replace function private.seed_user(
  p_id uuid,
  p_email text,
  p_password text,
  p_first_name text,
  p_last_name text,
  p_initials text,
  p_role public.user_role,
  p_wage_currency public.wage_currency default null,
  p_hourly_wage numeric default null,
  p_tags text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = auth, public, extensions
as $fn$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', array['email'],
      'role', p_role,
      'wage_currency', p_wage_currency,
      'hourly_wage', p_hourly_wage
    ),
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'initials', p_initials,
      'profile_tags', to_jsonb(p_tags)
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    p_id::text,
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  update public.profiles
  set
    first_name = p_first_name,
    last_name = p_last_name,
    initials = p_initials,
    email = p_email,
    role = p_role,
    wage_currency = p_wage_currency,
    hourly_wage = p_hourly_wage,
    profile_tags = p_tags
  where id = p_id;
end;
$fn$;

grant execute on function private.seed_user(
  uuid, text, text, text, text, text, public.user_role, public.wage_currency, numeric, text[]
) to postgres, service_role;

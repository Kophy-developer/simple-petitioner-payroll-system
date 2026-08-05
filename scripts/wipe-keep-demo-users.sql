-- DESTRUCTIVE: wipes all business data; keeps 8 seeded demo users only. Run manually, not as a migration.

begin;

create temporary table wipe_demo_ids (id uuid primary key) on commit drop;
insert into wipe_demo_ids (id) values
  ('11111111-1111-1111-1111-111111111101'),
  ('11111111-1111-1111-1111-111111111102'),
  ('11111111-1111-1111-1111-111111111103'),
  ('11111111-1111-1111-1111-111111111104'),
  ('11111111-1111-1111-1111-111111111105'),
  ('11111111-1111-1111-1111-111111111106'),
  ('11111111-1111-1111-1111-111111111107'),
  ('11111111-1111-1111-1111-111111111108');

update public.app_config set updated_by = null where updated_by is not null;

do $$
declare
  stmt text;
begin
  select 'truncate table ' || string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by c.relname)
    || ' restart identity cascade'
  into stmt
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname not in (
      'profiles',
      'app_config',
      'sub_accounts'
    );

  if stmt is not null then
    execute stmt;
  end if;
end $$;

do $$
begin
  begin
    execute 'alter table storage.objects disable trigger all';
    delete from storage.objects
    where bucket_id in ('receipts', 'validity_uploads', 'logos');
    execute 'alter table storage.objects enable trigger all';
  exception when others then
    begin
      execute 'alter table storage.objects enable trigger all';
    exception when others then null;
    end;
    raise notice 'storage cleanup skipped: %', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    delete from auth.mfa_amr_claims
    where session_id in (
      select id from auth.sessions s
      where s.user_id not in (select id from wipe_demo_ids)
    );
  exception when undefined_table then null;
  end;

  begin
    delete from auth.mfa_challenges
    where factor_id in (
      select id from auth.mfa_factors f
      where f.user_id not in (select id from wipe_demo_ids)
    );
  exception when undefined_table then null;
  end;

  begin
    delete from auth.mfa_factors
    where user_id not in (select id from wipe_demo_ids);
  exception when undefined_table then null;
  end;

  begin
    execute $q$
      delete from auth.refresh_tokens
      where user_id::text not in (select id::text from wipe_demo_ids)
    $q$;
  exception when undefined_table then null;
  end;

  begin
    delete from auth.sessions
    where user_id not in (select id from wipe_demo_ids);
  exception when undefined_table then null;
  end;

  begin
    delete from auth.identities
    where user_id not in (select id from wipe_demo_ids);
  exception when undefined_table then null;
  end;

  begin
    delete from auth.one_time_tokens
    where user_id not in (select id from wipe_demo_ids);
  exception when undefined_table then null;
  end;
end $$;

delete from public.profiles
where id not in (select id from wipe_demo_ids);

delete from auth.users
where id not in (select id from wipe_demo_ids);

update public.profiles
set
  employee_id = null,
  invite_sent_at = null,
  must_change_password = false,
  onboarding_complete = true,
  status = 'active',
  updated_at = now()
where id in (select id from wipe_demo_ids);

update auth.users
set
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  banned_until = null,
  deleted_at = null,
  updated_at = now()
where id in (select id from wipe_demo_ids);

insert into public.app_config (key, value)
values ('hold_pct', '15'::jsonb)
on conflict (key) do update
set value = excluded.value, updated_by = null, updated_at = now();

insert into public.app_config (key, value)
values ('benchmark_pct', '75'::jsonb)
on conflict (key) do update
set value = excluded.value, updated_by = null, updated_at = now();

select setval('public.employee_id_seq', 10001, false);

insert into public.team_memberships (lead_id, member_id) values
  ('11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111104'),
  ('11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111108')
on conflict do nothing;

commit;

select 'profiles' as entity, count(*)::bigint as n from public.profiles
union all select 'auth.users', count(*) from auth.users
union all select 'issues', count(*) from public.issues
union all select 'petitions', count(*) from public.petitions
union all select 'turn_ins', count(*) from public.turn_ins
union all select 'expenses', count(*) from public.expense_records
union all select 'validity_records', count(*) from public.validity_records
union all select 'ledger_rows', count(*) from public.ledger_rows
union all select 'ledger_lines', count(*) from public.ledger_lines
union all select 'brex', count(*) from public.brex_transactions
union all select 'payments', count(*) from public.payment_events
union all select 'team_memberships', count(*) from public.team_memberships
union all select 'role_categories', count(*) from public.role_categories
union all select 'storage.objects', count(*) from storage.objects
order by 1;

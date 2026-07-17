select private.seed_user(
  '11111111-1111-1111-1111-111111111101'::uuid,
  'alex@ballotaccesspros.com'::text,
  'demo1234'::text,
  'Alex'::text,
  'Whitfield'::text,
  'AW'::text,
  'super_admin'::public.user_role,
  null::public.wage_currency,
  null::numeric,
  array['leadership']::text[]
);
select private.seed_user(
  '11111111-1111-1111-1111-111111111102'::uuid,
  'morgan@ballotaccesspros.com'::text,
  'demo1234'::text,
  'Morgan'::text,
  'Ellis'::text,
  'ME'::text,
  'account_admin'::public.user_role,
  'USD'::public.wage_currency,
  22::numeric,
  array['ops']::text[]
);
select private.seed_user(
  '11111111-1111-1111-1111-111111111103'::uuid,
  'sam@ballotaccesspros.com'::text,
  'demo1234'::text,
  'Sam'::text,
  'Rivera'::text,
  'SR'::text,
  'team_lead'::public.user_role,
  null::public.wage_currency,
  null::numeric,
  array['field-lead']::text[]
);
select private.seed_user(
  '11111111-1111-1111-1111-111111111104'::uuid,
  'jordan@ballotaccesspros.com'::text,
  'demo1234'::text,
  'Jordan'::text,
  'Reed'::text,
  'JR'::text,
  'petitioner'::public.user_role,
  null::public.wage_currency,
  null::numeric,
  array['colorado']::text[]
);
select private.seed_user(
  '11111111-1111-1111-1111-111111111105'::uuid,
  'casey@ballotaccesspros.com'::text,
  'demo1234'::text,
  'Casey'::text,
  'Nguyen'::text,
  'CN'::text,
  'petitioner'::public.user_role,
  null::public.wage_currency,
  null::numeric,
  array['nevada']::text[]
);
select private.seed_user(
  '11111111-1111-1111-1111-111111111106'::uuid,
  'riley@ballotaccesspros.com'::text,
  'demo1234'::text,
  'Riley'::text,
  'Santos'::text,
  'RS'::text,
  'validator'::public.user_role,
  null::public.wage_currency,
  null::numeric,
  array['audit']::text[]
);
select private.seed_user(
  '11111111-1111-1111-1111-111111111107'::uuid,
  'taylor@ballotaccesspros.com'::text,
  'demo1234'::text,
  'Taylor'::text,
  'Brooks'::text,
  'TB'::text,
  'petitioner'::public.user_role,
  null::public.wage_currency,
  null::numeric,
  array['colorado']::text[]
);
select private.seed_user(
  '11111111-1111-1111-1111-111111111108'::uuid,
  'drew@ballotaccesspros.com'::text,
  'demo1234'::text,
  'Drew'::text,
  'Hayes'::text,
  'DH'::text,
  'petitioner'::public.user_role,
  null::public.wage_currency,
  null::numeric,
  array['colorado']::text[]
);

insert into public.team_memberships (lead_id, member_id) values
  ('11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111104'),
  ('11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111108')
on conflict do nothing;

insert into public.role_categories (id, name, description) values
  ('22222222-2222-2222-2222-222222222201', 'Management', 'Leadership and account operations'),
  ('22222222-2222-2222-2222-222222222202', 'Colorado Field', 'Colorado petition team'),
  ('22222222-2222-2222-2222-222222222203', 'Nevada Field', 'Nevada canvassing team'),
  ('22222222-2222-2222-2222-222222222204', 'Audit', 'Validity operators')
on conflict (id) do nothing;

insert into public.role_category_members (category_id, user_id) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101'),
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111102'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111103'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111104'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111108'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111105'),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111106')
on conflict do nothing;

insert into public.petitions (id, name, code, pay, lotus) values
  ('33333333-3333-3333-3333-333333333301', 'Ballot Access Reform', 'BAP', 1.00, 'A-12'),
  ('33333333-3333-3333-3333-333333333302', 'Citizen Initiative Drive', 'CID', 0.85, 'B-04')
on conflict (id) do nothing;

insert into public.issues (
  id, issue_number, name, petition_id, state, validated_by, turn_in_date, turn_in_number, pay_model
) values
  ('44444444-4444-4444-4444-444444444401', 'BAP-CO-09', 'Colorado Reform Drive — Fall Batch', '33333333-3333-3333-3333-333333333301', 'CO', 'Morgan Ellis', '2026-05-14', 'CO-2026-441', 'validity_standard'),
  ('44444444-4444-4444-4444-444444444402', 'BAP-NV-03', 'Nevada Signature Push', '33333333-3333-3333-3333-333333333301', 'NV', 'Morgan Ellis', '2026-06-02', 'NV-2026-118', 'validity_standard'),
  ('44444444-4444-4444-4444-444444444403', 'CID-AZ-01', 'Arizona Initiative Intake', '33333333-3333-3333-3333-333333333302', 'AZ', 'Alex Whitfield', '2026-06-18', 'AZ-2026-029', 'per_valid_sig')
on conflict (id) do nothing;

insert into public.pay_rate_configs (id, petition_id, issue_id, pay_rate) values
  ('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333301', '44444444-4444-4444-4444-444444444401', 1.50),
  ('55555555-5555-5555-5555-555555555502', '33333333-3333-3333-3333-333333333301', '44444444-4444-4444-4444-444444444402', 1.50),
  ('55555555-5555-5555-5555-555555555503', '33333333-3333-3333-3333-333333333302', '44444444-4444-4444-4444-444444444403', 1.25)
on conflict (id) do nothing;

insert into public.submission_records (
  id, user_id, issue_id, raw_signatures, page_numbers, pooled_signatures, pooled_pages, last_edited_by, last_edited_at
) values
  ('66666666-6666-6666-6666-666666666601', '11111111-1111-1111-1111-111111111104', '44444444-4444-4444-4444-444444444401', 36, 4, 36, 4, null, null),
  ('66666666-6666-6666-6666-666666666602', '11111111-1111-1111-1111-111111111107', '44444444-4444-4444-4444-444444444401', 42, 5, 41, 5, '11111111-1111-1111-1111-111111111102', '2026-06-20T14:00:00Z'),
  ('66666666-6666-6666-6666-666666666603', '11111111-1111-1111-1111-111111111108', '44444444-4444-4444-4444-444444444401', 28, 3, 28, 3, null, null),
  ('66666666-6666-6666-6666-666666666604', '11111111-1111-1111-1111-111111111104', '44444444-4444-4444-4444-444444444402', 51, 6, 50, 6, null, null),
  ('66666666-6666-6666-6666-666666666605', '11111111-1111-1111-1111-111111111107', '44444444-4444-4444-4444-444444444403', 33, 4, 33, 4, null, null)
on conflict (id) do nothing;

insert into public.validity_records (
  id, issue_id, user_id, dups, usable, valid, validity_pct, entry_method, entered_by, entered_at
) values
  ('77777777-7777-7777-7777-777777777701', '44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111104', 4, 31, 27, 75, 'upload', '11111111-1111-1111-1111-111111111106', now()),
  ('77777777-7777-7777-7777-777777777702', '44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111107', 6, 34, 29, 70, 'upload', '11111111-1111-1111-1111-111111111106', now()),
  ('77777777-7777-7777-7777-777777777703', '44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111108', 2, 25, 22, 79, 'manual', '11111111-1111-1111-1111-111111111106', now()),
  ('77777777-7777-7777-7777-777777777704', '44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111107', 3, 28, 24, 73, 'upload', '11111111-1111-1111-1111-111111111106', now())
on conflict (id) do nothing;

select private.recalculate_ledger_row(
  '11111111-1111-1111-1111-111111111104'::uuid,
  '44444444-4444-4444-4444-444444444401'::uuid
);
select private.recalculate_ledger_row(
  '11111111-1111-1111-1111-111111111107'::uuid,
  '44444444-4444-4444-4444-444444444401'::uuid
);
select private.recalculate_ledger_row(
  '11111111-1111-1111-1111-111111111108'::uuid,
  '44444444-4444-4444-4444-444444444401'::uuid
);
select private.recalculate_ledger_row(
  '11111111-1111-1111-1111-111111111104'::uuid,
  '44444444-4444-4444-4444-444444444402'::uuid
);
select private.recalculate_ledger_row(
  '11111111-1111-1111-1111-111111111107'::uuid,
  '44444444-4444-4444-4444-444444444403'::uuid
);

insert into public.expense_records (id, user_id, issue_id, type, amount, receipt_path, expense_date, end_date) values
  ('88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111104', '44444444-4444-4444-4444-444444444401', 'hotel_travel', 124.50, 'marriott-co.pdf', '2026-07-02', '2026-07-04'),
  ('88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111104', null, 'upfront_draw', 85.00, 'fuel.jpg', '2026-07-03', null),
  ('88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111104', '44444444-4444-4444-4444-444444444401', 'chargeback', 42.00, 'supplies.pdf', '2026-07-05', null),
  ('88888888-8888-8888-8888-888888888804', '11111111-1111-1111-1111-111111111107', null, 'car_rental', 180.00, 'hertz.pdf', '2026-07-01', '2026-07-03'),
  ('88888888-8888-8888-8888-888888888805', '11111111-1111-1111-1111-111111111105', null, 'housing', 95.00, 'rent.jpg', '2026-07-06', '2026-07-06')
on conflict (id) do nothing;

insert into public.car_rental_configs (id, config_type, rate, issue_id) values
  ('99999999-9999-9999-9999-999999999901', 'per_issue', 45.00, '44444444-4444-4444-4444-444444444401'),
  ('99999999-9999-9999-9999-999999999902', 'per_issue', 50.00, '44444444-4444-4444-4444-444444444402')
on conflict (id) do nothing;

insert into public.housing_configs (id, config_type, rate, issue_id) values
  ('99999999-9999-9999-9999-999999999911', 'standard', 95.00, null)
on conflict (id) do nothing;

insert into public.loan_requests (
  id, user_id, amount_requested, hold_balance_snapshot, note, status, reviewed_by, reviewed_at, created_at
) values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '11111111-1111-1111-1111-111111111104',
    50.00,
    80.00,
    'Need an advance for lodging before next turn-in payout.',
    'pending',
    null,
    null,
    '2026-06-28T14:22:00Z'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '11111111-1111-1111-1111-111111111107',
    120.00,
    9.00,
    'Car repair bridge until hold releases.',
    'auto_rejected',
    null,
    null,
    '2026-06-25T09:10:00Z'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '11111111-1111-1111-1111-111111111108',
    25.00,
    6.30,
    'Grocery run between collection weekends.',
    'approved',
    '11111111-1111-1111-1111-111111111101',
    '2026-06-20T18:10:00Z',
    '2026-06-20T16:45:00Z'
  )
on conflict (id) do nothing;

update public.app_config
set value = '75'::jsonb
where key = 'benchmark_pct';

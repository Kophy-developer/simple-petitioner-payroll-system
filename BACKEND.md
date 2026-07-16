# Backend setup (Phase 1)

DigitalOcean can wait. Local Supabase is enough to build and test the backend.

## Prerequisites

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
2. Supabase CLI (`brew install supabase/tap/supabase`)

## Start local backend

```bash
cd "/Users/macpro/Projects/Ballot Access Pros Payroll"
supabase start
supabase db reset
supabase status
```

Copy keys into `web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

`SUPABASE_SERVICE_ROLE_KEY` is required for Admin → Create user (server API route).

## What is already in the repo

| Path | Purpose |
|---|---|
| `supabase/migrations/20260714150701_phase1_schema.sql` | Phase 1 tables, enums, RLS |
| `supabase/migrations/20260714150702_phase1_ledger_functions.sql` | Pay calc, loans, expenses, payroll RPCs |
| `supabase/migrations/20260714150703_phase1_storage.sql` | Receipts, logos, validity upload buckets |
| `supabase/migrations/20260714150704–07_*.sql` | Seed helper, grants, submission + admin RPCs |
| `supabase/migrations/20260714150708_phase1_finish_rpcs.sql` | Validity upload batch, update issue, payroll draft/lock |
| `supabase/seed.sql` | Demo users + sample operational data |

Demo password for all seeded users: `demo1234`

## Core RPCs

- `preview_submission_edit` / `confirm_submission_edit`
- `upsert_validity_manual` / `apply_validity_upload`
- `request_loan` / `review_loan`
- `create_expense` / `expense_balance` / `suggested_expense_amount`
- `run_monthly_payroll(month, year, lock)` / `lock_monthly_payroll`
- `update_pay_rate` / `set_benchmark` / `update_user_admin` / `update_issue`

## Validity Excel format

Columns (first sheet): `Initials` or `Email`, `DUPs`, `Usable`, `Valid`, `Validity%`.

Sample file: `web/public/samples/validity-sample.csv`

## When DigitalOcean arrives

1. Provision droplet + Docker Compose self-hosted Supabase
2. Apply the same migrations (`supabase db push` or migrate against remote)
3. Point Vercel env vars at the DO URL/keys (including service role for create-user)
4. Configure SMTP for password reset emails (local uses Inbucket on :54324)

## Pending outside Phase 1 app work

- Point Vercel at DigitalOcean when hosting is ready
- Phase 2: Messages, role categories, GPS, clock-in, payment disbursement, mobile

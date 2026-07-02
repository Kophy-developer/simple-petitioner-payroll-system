# Ballot Access Pros — Circulator Management & Payroll

Monorepo for the Ballot Access Pros platform.

## Structure

| Path | Purpose |
|---|---|
| `web/` | Next.js web app (Vercel) |
| `supabase/` | Database migrations, Edge Functions |
| `flutter/` | Phase 2 mobile app (reserved) |
| `assets/` | Brand assets |
| `BUILD_PROMPT.md` | Product + technical spec |

## Stack

- **Web:** Next.js 16, TypeScript, Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions)
- **Deploy:** Vercel for `web/` only
- **Mobile (later):** Flutter + `supabase_flutter`

## Local setup

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com)
2. Install the CLI if needed: `brew install supabase/tap/supabase`
3. Link the project from repo root:

```bash
cd "/Users/macpro/Projects/Ballot Access Pros Payroll"
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

4. Apply migrations:

```bash
supabase db push
```

### 2. Web app

```bash
cd web
cp .env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase → Project Settings → API.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Payroll regression tests

```bash
cd web
npm run test:payroll
```

## Vercel deployment

1. Push this repo to GitHub
2. Import the repo in [Vercel](https://vercel.com/new)
3. Set **Root Directory** to `web`
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy

Preview deployments will run on every branch push once connected.

## GitHub

If `gh` is not authenticated yet:

```bash
gh auth login
cd "/Users/macpro/Projects/Ballot Access Pros Payroll"
git init
git add .
git commit -m "Initial project scaffold for Ballot Access Pros platform"
gh repo create ballot-access-pros-payroll --private --source=. --remote=origin --push
```

Use your preferred repo name and visibility.

## What is already in place

- Brand-themed Next.js shell with route placeholders for all 10 screens
- Supabase schema: circulators, issues, submissions, validity, ledger, payroll, loans, audit
- Postgres payroll calculation function + TypeScript mirror with regression tests
- RLS policies for circulator isolation and admin/super-admin access
- Storage buckets for receipts, logos, and validity uploads

## Next build steps

1. Supabase Auth UI (email login) + role assignment on `profiles`
2. Circulator submission flow wired to `submission_records`
3. Admin Master Collection Table
4. Validity Excel import Edge Function + preview UI
5. Ledger and payroll screens
6. Issue Report PDF Edge Function

See `BUILD_PROMPT.md` for full product requirements.

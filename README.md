# Ballot Access Pros — Circulator Management & Payroll

Phase 1 web platform for Ballot Access Pros.

## Structure

| Path | Purpose |
|---|---|
| `web/` | Next.js web app (Vercel) |
| `supabase/` | Database migrations (backend phase) |
| `assets/` | Brand assets |
| `BUILD_PROMPT.md` | Phase 1 product + technical spec |

## Phase 1 scope

Users & roles, issues & petitions, submissions, validity, ledger, expenses & payroll, loans & advances, admin configuration.

**Out of scope (Phase 2):** GPS, clock-in/out, messaging, role categories, Campaign Sidekick, payment API, mobile apps.

## Stack

- **Web:** Next.js, TypeScript, Tailwind CSS
- **Backend:** Self-hosted Supabase (local now; DigitalOcean when the client provides access)
- **Deploy:** Vercel for `web/`

## Local setup (frontend demo)

```bash
cd web
cp .env.example .env.local
npm install
npm run test:payroll
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo password for all accounts: `demo1234`

## Local setup (backend)

DigitalOcean is not required yet.

**If you are non-technical, follow [SETUP_GUIDE.md](./SETUP_GUIDE.md) step by step.**

Developer quick path (Docker Desktop + Supabase CLI required):

```bash
supabase start
supabase db reset
supabase status
```

Details: [BACKEND.md](./BACKEND.md).

## Payroll regression tests

```bash
cd web
npm run test:payroll
```

## Environment

Copy `web/.env.example` to `web/.env.local`. Important server-only vars:

| Variable | Purpose |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin user create / roster / invites |
| `CRON_SECRET` | Bearer token for `/api/cron/*` |
| `BREX_API_TOKEN` | Brex API sync (never commit a real token; rotate if leaked) |

## Field Ops accrual cron

Schedule a daily call shortly after midnight **America/Denver**:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron/field-ops-accrual
```

## Migrations

Apply new Supabase migrations on the droplet / host before relying on Field Ops, Brex, invites, or batch payroll:

```bash
supabase db push
# or: supabase migration up
```

Latest product migration: `supabase/migrations/20260726083632_locked_product_features.sql`

## Colorado validity drop folder

Place vendor files in `data/colorado-validity-drop/` (see README there). UI scaffold: **CO Validity Drop** in the app.

## Vercel

Root directory: `web`

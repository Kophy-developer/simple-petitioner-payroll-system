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

## Vercel

Root directory: `web`

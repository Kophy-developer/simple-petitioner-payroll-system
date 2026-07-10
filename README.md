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

**Out of scope (Phase 2):** GPS, clock-in/out, messaging, Campaign Sidekick, payment API, mobile apps.

## Stack

- **Web:** Next.js, TypeScript, Tailwind CSS
- **Backend (planned):** Self-hosted Supabase on DigitalOcean
- **Deploy:** Vercel for `web/`

## Local setup

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo password for all accounts: `demo1234`

## Payroll regression tests

```bash
cd web
npm run test:payroll
```

## Vercel

Root directory: `web`

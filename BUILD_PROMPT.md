# Build Prompt: Ballot Access Pros — Phase 1

## Scope

**Phase 1 only:** web app for users & roles, ledger & pay, expenses & payroll, loans & advances.

**Do not build in Phase 1:** GPS, clock-in/out, messaging (except nav “Coming soon”), Campaign Sidekick, payment API, mobile apps.

## Stack

| Layer | Choice |
|---|---|
| Web | Next.js, TypeScript, Tailwind |
| Backend (later) | Self-hosted Supabase on DigitalOcean |
| Deploy | Vercel for web |
| Calls (Phase 2) | Agora |
| Maps (Phase 2) | Mapbox |

## Roles

super_admin · account_admin · team_lead · petitioner · canvasser · validator

## Phase 1 screens

A1 Login · A2 Profile · S1 Dashboard · S2 Issues & Petitions · S3 Submissions · S4 Master Collection · S4a Issue Report PDF · S5 Ledger · S6 Validity · S7 Directory · S8 Payroll & Expenses · S9 Loans · S10 Monthly Payroll · S11 Pay Rates + Benchmark · S12 Car & Housing · S13 Role Categories · S14 Admin Panel · Messages (Coming soon placeholder)

## Pay models

- **Validity Standard:** benchmark comparison → payable
- **Per Valid Sig:** payable = valid

## Key rules

- Server-side calculations only; UI displays API values
- Retroactive submission edits require confirmation modal
- `recalculated_at` visible on ledger sections
- Validity columns show “—” until entered
- Loan ineligibility shows no reason
- Locked monthly payroll is immutable
- Shared BAP login across products (same auth service)

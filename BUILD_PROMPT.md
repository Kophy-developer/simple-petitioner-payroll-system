# Build Prompt: Ballot Access Pros — Circulator Management & Payroll Platform

## 0. What to build

A two-phase platform for **Ballot Access Pros**:

- **Phase 1 (now):** responsive web app (Next.js on Vercel) + Supabase backend.
- **Phase 2 (later):** Flutter mobile app (iOS/Android) consuming the same API — no backend rework.

Build the backend so Phase 2 is only a new client. No schema or business-logic rewrites.

---

## 1. Locked technology stack

| Layer | Choice | Notes |
|---|---|---|
| Web | Next.js 15, TypeScript, Tailwind, shadcn/ui | Deploy on Vercel (frontend only) |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) | Free tier for dev; RLS for RBAC |
| Mobile (Phase 2) | Flutter + `supabase_flutter` | Same auth, storage, and RPC surface |
| API | REST via PostgREST + Supabase RPC | Version RPCs under stable names; maintain OpenAPI where custom routes exist |
| PDF / Excel | Supabase Edge Functions | Not Vercel serverless (timeouts, body limits) |

**Vercel hosts the web app only.** Business logic, PDF generation, and Excel parsing run in Postgres functions and/or Supabase Edge Functions so Flutter and web share identical behavior.

---

## 2. Brand & Design System

**Identity:** quill pen + signature squiggle mark, serif small-caps wordmark ("BALLOT ACCESS" / "PROS"). Tone: civic, legal, trustworthy, premium.

| Role | Color | Notes |
|---|---|---|
| Ink (primary dark) | `#111114` | Backgrounds, headers, logo plate |
| Parchment (primary light) | `#FAF6EE` | Page background |
| Accent — Brass/Gold | `#C6A15B` | Primary CTA, active states, key metrics |
| Accent — Civic Navy | `#1E2A45` | Secondary actions, links, nav, charts |
| Success | `#2F7A4E` | Positive balance, approved |
| Warning | `#C97A2B` | Pending, below-benchmark flags |
| Danger | `#B23B3B` | Negative balance, rejected |

**Typography:** serif display for headings/wordmark; clean grotesk/sans for UI; tabular figures for all monetary and ledger numbers.

---

## 3. Roles & Permissions (strict RBAC — Postgres RLS + API checks)

| Role | Can do |
|---|---|
| **Circulator** | Submit SIGs/books per issue; view **own** Ledger only; submit expenses w/ receipt; view own Upfront/Hold/Balance; request loan/advance |
| **Admin** | Read all circulator data; Master Collection Table; Issue Report PDF; upload validity Excel; Employee Directory & any Ledger |
| **Super Admin** | Everything Admin + Petition Pay Table; Pay Rate per issue; Benchmark %; approve/reject loans; (future) manual validity entry |

Store roles in `profiles.role` (or `app_metadata` set only by service role). **Never authorize from `user_metadata`.** Circulators must never read another circulator's Ledger, expenses, or PII — enforce with RLS policies, not UI hiding alone.

---

## 4. Data Model

All money fields use `NUMERIC(12,2)` (never float).

- **profiles** — links `auth.users`, role, circulator_id (nullable for pure admins)
- **circulators** — first/last name, initials, status (active/inactive), auth link
- **petitions** — name, code, pay, lotus (literal field name)
- **issues** — issue_number (`[PetitionCode]-[StateCode]-[Sequence]`), name, petition_id, state, validated_by, turn_in_date, turn_in_number, business_logo_path
- **submission_records** — circulator_id, issue_id, raw_signatures, page_numbers, pooled_signatures, pooled_pages; one active row per circulator×issue (upsert on resubmit)
- **pay_rates** — issue_id (unique), rate (per-issue override; issue already has petition FK)
- **app_settings** — singleton row: benchmark_percent
- **validity_records** — circulator_id, issue_id, dups, usable, valid_count, validity_percent (as-uploaded, never recalculated), upload_id
- **validity_uploads** — issue_id, storage_path, uploaded_by, row_count, created_at (audit + re-upload tracking)
- **ledger_rows** — materialized per circulator×issue; recalculated when submissions, validity, pay, pay_rate, or benchmark change
- **expenses** — circulator_id, type (draw / chargeback / hotel_travel / other), amount, receipt_path, expense_date
- **loan_requests** — circulator_id, amount, hold_snapshot, status, reviewed_by, reviewed_at
- **hold_disbursements** — approved loan amounts that reduce available Hold
- **audit_events** — append-only: entity, action, actor_id, old/new JSON, created_at

### Defaults (documented decisions)

- **Pooled Signatures / Pooled Pages:** admin-editable on submission_records; default equals raw_signatures / page_numbers until admin adjusts in Master Collection Table.
- **Ledger before validity:** Payable, Total Pay, Upfront, Hold show as null/pending until validity upload for that issue.
- **Total Upfront on Payroll screen:** sum of ledger `upfront` across all issues for that circulator (allocated, not cash-disbursed tracking in v1).
- **Balance:** `total_upfront_allocated - total_expenses`; flag prominently if negative.
- **Hold:** `sum(ledger.hold) - sum(approved hold_disbursements)`; never reduced by expenses.
- **Loan approval:** creates `hold_disbursement`; pending requests reserve Hold via snapshot at submit time.
- **Validity Excel matching:** match circulator by normalized full name; admin preview before commit; re-upload replaces validity for that issue and triggers ledger recalc.
- **Inactive circulators:** can log in and view history; cannot submit new work or expenses.

---

## 5. Calculation Logic — server-side, unit-tested

```sql
estimated_pay = sigs * pay

payable:
  if validity_percent >= benchmark_percent:
    payable = sigs
  else:
    shortfall = benchmark_percent - validity_percent
    payable = round(sigs * (1 - shortfall / 100.0))

total_pay = pay * payable * pay_rate
upfront = total_pay * 0.85
hold = total_pay * 0.15

payroll_balance = sum(upfront) - sum(expenses)
available_hold = sum(hold) - sum(approved_disbursements)
```

**Regression tests (required in CI):**

- SIGs=36, Validity%=75%, Benchmark%=75%, Pay=1.00, Pay Rate=1.50 → Payable=36, Total Pay=54.00, Upfront=45.90, Hold=8.10
- Validity%=70% → Payable=34, Total Pay=51.00

Validity % always from upload — never recalculated from Valid/SIGs.

---

## 6. Phase 1 — Web App Screens

1. Circulator Submission
2. Master Collection Table (Admin+)
3. Issue Report PDF (Admin, server-generated)
4. Employee Directory (Admin+)
5. Circulator Ledger
6. Petition Pay Table (Super Admin)
7. Validity Records Upload (Admin) — defensive header matching, preview step
8. Pay Rate Configuration (Super Admin)
9. Payroll & Expense Tracking
10. Loan/Advance Request queue (Super Admin)

Cross-cutting: auth on every route; signed URLs for receipt/logo uploads; audit trail on financial config changes; negative balance and declined advances visually unmissable.

---

## 7. Backend requirements

- Supabase CLI migrations in `supabase/migrations/`
- RLS enabled on every public table
- Edge Functions: `generate-issue-report`, `import-validity-excel`
- Storage buckets: `receipts`, `logos`, `validity-uploads` (private; signed upload/download)
- Separate Supabase projects: dev / staging / prod
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel; service role only in Edge Functions

---

## 8. Phase 2 — Flutter (not building yet)

Flutter app for circulators: submit signatures, own ledger, expenses with camera, advances, balances. Admin functions remain web-primary. Export design tokens from web for `ThemeData`. No new business logic.

---

## 9. Confirmed clarifications (final)

- "Lotus" is a literal field name — keep as-is.
- Every "user" in the original spec = Circulator for loan requests.
- Validity % from upload only.
- Expenses sync automatically, no approval workflow.
- Negative balance must be flagged, not hidden.
- Declined advances show no reason in v1 (extension point for later).

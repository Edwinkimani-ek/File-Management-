# Wakili Case Manager

Cloud file and case management for Kenyan law firms. Phase 1 — the MVP a
single pilot firm runs its live matters on for a 90-day trial.

- Next.js 14 (App Router, TypeScript) — one codebase, front and back
- Supabase (Postgres) — database, auth and storage, with row-level
  security on every table
- Tailwind CSS — mobile-first, because advocates use this in court
  corridors on a phone
- Vercel + Supabase cloud for hosting

---

## What is in Phase 1

| Feature | What it does |
|---|---|
| Auth, firms, users | Firm signup, email invitations, roles, disable a user, firm settings |
| Clients | Individuals and companies, duplicate warnings, firm-wide conflict check |
| Matters | The digital brown file: header plus Documents / Diary / Fee notes / Activity |
| Documents | Drag-and-drop and camera upload, private storage, ten-minute signed URLs |
| Court diary | Month and agenda views, 7/3/1-day reminders, 07:00 digest, limitation helper |
| Fee notes | Line items, VAT, partner approval, manual payments, letterheaded PDF, reports |

Deliberately **not** in Phase 1: e-filing, live M-Pesa collection,
document automation, trust accounting, time tracking, AI, native apps.

## The three roles

| Role | Can do |
|---|---|
| **Partner** | Everything: all matters, all fee notes, user management, settings, reports |
| **Associate** | Assigned and firm-wide matters; documents and diary entries; draft fee notes, cannot approve |
| **Clerk** | Assigned matters only; upload documents; view the diary; **no** access to fee notes or client money |

Every one of these rules exists twice: once in the interface, so nobody is
offered a button that will fail, and once in a database policy, which is
what actually stops a forged request. The interface is a courtesy. The
policy is the control.

---

## Running it locally

You need Node 20+ and a Supabase project (use a free one; call it
`wakili-staging`).

```bash
git clone <this repo> && cd File-Management-
npm install
cp .env.example .env.local     # then fill it in — see below
```

### 1. Apply the schema

In the Supabase SQL editor, run the files in `supabase/migrations/` **in
order**:

```
0001_schema.sql            tables, enums, indexes
0002_security_helpers.sql  the app schema the policies are built on
0003_rls.sql               row-level security, enabled and forced
0004_business_rules.sql    triggers: totals, approval, payment status
0005_storage.sql           private buckets and their object policies
0006_rpc.sql               conflict check, file reference suggestion
```

Or with the Supabase CLI, if the project is linked:

```bash
supabase db push
```

### 2. Fill in `.env.local`

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Project settings → API. Server only — it bypasses RLS |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally |
| `RESEND_API_KEY` | Optional. Unset, emails are printed to the server log |
| `MAIL_FROM` | e.g. `Wakili <noreply@yourfirm.co.ke>` |
| `CRON_SECRET` | Any long random string; guards `/api/cron/*` |

### 3. Seed the demo data

```bash
SEED_CONFIRM=yes node scripts/seed.mjs
```

This creates **two** firms with users, clients, matters, diary entries and
fee notes across every status. Two firms is the point: the security
checklist asks you to try reaching one firm's records while signed in as
the other, and that needs a real second tenant. The script prints the
sign-in details and the ids to paste into the URL bar.

It refuses to run without `SEED_CONFIRM=yes`, because it writes with the
service role key and that key can just as easily be pointed at production.

### 4. Run it

```bash
npm run dev
```

Other scripts: `npm run build`, `npm run typecheck`, `npm run lint`.

### Testing the security rules

The rules that matter — tenancy, the three roles, the fee note workflow —
live in policies and triggers, so they are tested where they actually are
rather than through the interface above them:

```bash
npm run test:db      # needs a local Postgres 15+; touches no Supabase project
```

It builds a throwaway database, applies a small stand-in for the parts of
Supabase the schema leans on (`auth.uid()`, the storage tables, the three
roles), applies every migration, runs `supabase/checks/rls_audit.sql`, and
then asserts about fifty rules — that Firm A cannot read *or write*
anything of Firm B's, that an associate cannot see a colleague's
assigned-only file, that a clerk gets nothing at all from `fee_notes`,
that an associate cannot approve a fee note even by setting the column
directly, that payments summing to the total flip the status on their own,
that the activity log cannot be rewritten.

Run it before every deploy. It caught a real one during the build:
Postgres re-checks the SELECT policies against the row an UPDATE produces,
which meant setting `deleted_at` made a record fail its own visibility
policy and the soft delete refused itself.

---

## Deploying

Two Supabase projects — `staging` and `production` — and two Vercel
environments pointed at them. A migration runs against staging first,
always.

1. Import the repo into Vercel.
2. Set the environment variables above per environment. `NEXT_PUBLIC_SITE_URL`
   must be the real deployed URL, or invitation and password-reset links
   will point at the wrong host.
3. In Supabase → Authentication → URL Configuration, add
   `https://<your-domain>/auth/callback` to the redirect allow-list.
4. `vercel.json` schedules `/api/cron/reminders` at 04:00 UTC, which is
   07:00 in Nairobi. Vercel sends `CRON_SECRET` as a bearer token
   automatically once it is set in the project.
5. Turn on daily backups — see `docs/BACKUPS.md`.

---

## How the security actually works

Worth reading once before the pilot, because it is the part that matters
most and the part that is easiest to get subtly wrong.

**Tenancy.** Every table carries `firm_id`. Every policy requires
`firm_id = app.firm_id()`. There is no exception and no table that opts
out; `supabase/checks/rls_audit.sql` fails the build of a table that tries.

**The helpers.** `app.firm_id()`, `app.user_role()`, `app.is_partner()`
and friends live in a private `app` schema and are `SECURITY DEFINER` with
a pinned `search_path`. They must be: a policy on `public.users` that
queried `public.users` under RLS would recurse forever. Each of them
returns nothing for a user whose status is `disabled`, which is what makes
disabling someone take effect on their very next statement rather than
whenever their token happens to expire.

**Matter visibility.** `app.can_see_matter()` encodes the role table:
partners see every matter in the firm, associates see the ones assigned to
them plus anything marked firm-wide, clerks see only what is assigned to
them. Documents, diary entries and fee notes all defer to it, so a
document cannot be more visible than the matter it is filed under.

**Closed matters.** `app.can_write_matter()` is the same check plus "and
the matter is not closed, unless you are a partner". A closed file is
read-only for everyone else — in the UI and in the database.

**Money.** Clerks have no `select` policy on `fee_notes` or `payments` at
all. Not a filtered view — no policy. A clerk querying PostgREST directly
gets `[]`, and the fee note pages 404 for them.

**Storage.** Both buckets are private. Object keys are
`<firm_id>/<matter_id>/<uuid>-<name>`, and the storage policies read those
segments back, so a signed URL minted for one firm is useless to another.
Downloads go through `/api/documents/[id]`, which looks the row up as the
signed-in user — an id from another firm simply is not there — and then
signs for ten minutes.

**Business rules in the database, not just the action.** Fee note totals
are recomputed from the line items by a trigger, so a posted subtotal that
does not match its lines cannot be stored. Approval raises `42501` for
anyone who is not a partner, so hiding the Approve button is a courtesy
rather than the control. Payment status is derived from the payments
ledger by a trigger; no code path sets "paid" by hand. Soft deletes are
partner-only in the trigger as well as the policy.

**The audit trail.** `activity_log` has an insert policy and no update or
delete policy — it is append-only. Logins, document views and downloads,
fee note approvals, role changes and matter deletions all land in it; the
ones the database can see for itself (approvals, role changes, matter
deletions) are written by triggers rather than by application code, so
they cannot be skipped.

---

## Conventions

- **Money** is an integer number of KES cents, everywhere, end to end.
  Nothing stores a float. `formatKes(15000000)` gives `KSh 150,000.00`.
- **Dates** display as DD/MM/YYYY. The timezone is `Africa/Nairobi`;
  timestamps are stored in UTC and rendered in Nairobi.
- **Deletes** are soft. `matters`, `clients` and `documents` carry
  `deleted_at`; nothing is hard-deleted in Phase 1.
- **Lists** all have a search box, filters and 25-per-page pagination.
- **Uploads** are PDF, DOCX, DOC, JPG and PNG, up to 25 MB, checked in the
  browser, in the server action, and by the bucket.

## Before the pilot

- `docs/ACCEPTANCE-TESTS.md` — the acceptance tests for all six features
- `docs/SECURITY-CHECKLIST.md` — the owner's pre-pilot security checklist
- `docs/BACKUPS.md` — daily backups and the restore test
- `supabase/checks/rls_audit.sql` — must return zero rows

Phase 1 is complete when all of those pass, demo data is gone from
production, the firm's users are invited, and 10–20 of their live files
have been migrated together, in person, at their office.

## Repository layout

```
src/app/(auth)/       sign in, sign up, invitations, password reset
src/app/(app)/        the application shell and every signed-in page
src/app/api/          document downloads, fee note PDFs, the cron job
src/components/       shared UI, plus matter/diary/fee-note pieces
src/lib/              auth, money, dates, uploads, email, PDF rendering
supabase/migrations/  the schema, policies and triggers, in order
supabase/checks/      the RLS audit
scripts/seed.mjs      two demo firms with everything filled in
docs/                 acceptance tests, security checklist, backups
```

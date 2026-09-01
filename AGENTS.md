# Wakili Case Manager — Agent Guide

This file is for AI coding agents working on the Wakili Case Manager codebase. It assumes no prior knowledge of the project. Everything here is derived from the actual repository contents.

---

## Project overview

Wakili Case Manager is a cloud-based file and case-management system for Kenyan law firms. Phase 1 is an MVP designed for a single pilot firm to run live matters on for a 90-day trial.

The system is multi-tenant by design. Each law firm is a separate tenant. Within a firm there are three roles:

- **Partner** — full access: all matters, all fee notes, user management, firm settings, reports.
- **Associate** — assigned matters plus firm-wide matters; can create clients, matters and diary entries; can draft fee notes but cannot approve them.
- **Clerk** — assigned matters only; can upload documents and view the diary; no access to fee notes or payments.

The central architectural decision is that security lives in the database, not just the UI. Every access rule is enforced by Supabase row-level security (RLS) policies. The UI layer hides buttons that would fail, but the policies are the actual control.

Phase 1 deliberately excludes: e-filing, live M-Pesa collection, document automation, trust accounting, time tracking, AI features and native apps.

### Target devices

The pilot is expected to run on tablets and desktop computers (viewports of 768 px and wider). The interface is built mobile-first with Tailwind, but small-phone optimisation is a nice-to-have rather than a requirement for go-live.

---

## Technology stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, React Server Components, Server Actions) |
| Language | TypeScript 5.6 (strict mode) |
| Styling | Tailwind CSS 3.4 with a custom colour palette (`ink` and `brand`) |
| PostCSS | `tailwindcss`, `autoprefixer` |
| Database | Supabase Postgres |
| Auth | Supabase Auth (row-level security enforces the rest) |
| Storage | Supabase Storage (private buckets only) |
| Email | Resend (optional; falls back to console logging when not configured) |
| Hosting | Vercel (project id: `file-management-beige`) |

Key runtime libraries:

- `@supabase/ssr` for cookie-based server and browser clients.
- `@supabase/supabase-js` for the service-role/admin client.
- `zod` for form validation.
- `pdf-lib` for fee-note PDF generation.
- `date-fns` / `date-fns-tz` for Kenyan date formatting.
- `lucide-react` for icons.

---

## Project structure

```
src/
  app/
    (app)/            Signed-in application shell and pages
    (auth)/           Login, signup, forgot/reset password, invitations
    api/              Document downloads, fee-note PDFs, cron job
    auth/callback/    Supabase auth callback route
    forbidden/        403 page
    globals.css       Tailwind entry + component classes
    layout.tsx        Root layout
    page.tsx          Landing page (redirects to /dashboard or /login)
  components/
    conflict/         Conflict-check panel
    diary/            Diary forms, month calendar, agenda list
    fees/             Fee-note form and workflow panel
    layout/           Navigation
    matter/           Document upload/list, close-matter panel, matter tabs
    ui/               Shared UI primitives (Alert, Badge, Pagination, etc.)
  lib/
    activity.ts       Activity-log helper
    auth.ts           Session context, role gating
    dates.ts          Africa/Nairobi date helpers
    email.ts          Resend wrapper + HTML email layout
    env.ts            Environment-variable validation
    feeNotePdf.ts     PDF rendering
    forms.ts          Form-state helpers + friendly DB errors
    invitations.ts    Invitation tokens and emails
    labels.ts         Enum-to-label maps
    matters.ts        Matter loader + write-permission helper
    money.ts          KES cent formatting/parsing
    permissions.ts    Role capability map (UI only)
    references.ts     File-reference helpers
    reminders.ts      Diary reminder email builders
    storage.ts        Signed-URL helper
    supabase/         server.ts, browser.ts, admin.ts clients
    types.ts          TypeScript domain types
    uploads.ts        File validation and safe file-name helpers

supabase/
  migrations/         Ordered SQL migrations (0001–0006)
  checks/             rls_audit.sql, policy_inventory.sql
  tests/              Local Postgres shim and policy tests
  seed.sql            Schema seed (if any)
  seed_demo_data.sql  Business-data seed

scripts/
  seed.mjs            Creates two demo firms via service-role client
  test-db.sh          Runs policy tests against a throwaway local Postgres

docs/
  ACCEPTANCE-TESTS.md     Feature-by-feature acceptance checklist
  SECURITY-CHECKLIST.md   Pre-pilot security checklist
  BACKUPS.md              Backup and restore instructions
  PILOT-PROGRESS.md       Build status and outstanding actions
```

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values.

| Variable | Required | Source / notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server only) | Supabase project settings → API. Bypasses RLS; never expose to the browser |
| `NEXT_PUBLIC_SITE_URL` | Yes | `http://localhost:3000` locally; deployed URL on Vercel |
| `RESEND_API_KEY` | No | Resend dashboard. If unset, emails are logged to the server console |
| `MAIL_FROM` | No | e.g. `Wakili <onboarding@resend.dev>` |
| `CRON_SECRET` | Yes (deployed) | Long random string guarding `/api/cron/*` |

The `env.ts` module validates credentials on first use and gives clear error messages for common mistakes such as copying a masked dashboard value.

---

## Build and test commands

All commands run from the project root.

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Production build
npm run build

# Type check (no emit)
npm run typecheck

# Lint
npm run lint

# Start the production server
npm start

# Run the database policy/trigger tests against a local Postgres
npm run test:db
```

The database test script (`scripts/test-db.sh`) needs a local Postgres 15+ but no Supabase project. It creates a throwaway database named `wakili_test` (override with `TEST_DB`), applies a shim for `auth.uid()`, `auth.role()` and storage tables, applies every migration, runs the RLS audit (which must return zero rows), and executes the policy tests in `supabase/tests/01_policies_test.sql`.

Run `npm run test:db` before every deploy.

---

## Database schema and migrations

Migrations live in `supabase/migrations/` and must be applied in order:

1. `0001_schema.sql` — tables, enums, indexes.
2. `0002_security_helpers.sql` — `app.*` helper functions used by policies.
3. `0003_rls.sql` — row-level security policies.
4. `0004_business_rules.sql` — triggers for fee notes, payments, documents, matters, clients, users.
5. `0005_storage.sql` — private storage buckets and object policies.
6. `0006_rpc.sql` — public helper functions (`conflict_check`, `suggest_file_reference`).

Apply them via the Supabase SQL editor or `supabase db push` if the project is linked.

### Core tables

- `public.firms` — one row per tenant.
- `public.users` — one row per authenticated user; `id` mirrors `auth.users.id`.
- `public.invitations` — partner-issued invitations with hashed tokens.
- `public.clients` — individuals and companies; soft-deleted via `deleted_at`.
- `public.matters` — the digital case file; file references are unique per firm.
- `public.documents` — metadata for uploaded files; files live in Supabase Storage.
- `public.diary_events` — court dates, deadlines, meetings.
- `public.diary_reminders_sent` — idempotency ledger for reminder emails.
- `public.fee_notes` — line items, VAT, totals, status.
- `public.fee_note_sequences` — per-firm, per-year counters for `FN-YYYY-####` numbering.
- `public.payments` — payment ledger against fee notes.
- `public.activity_log` — append-only audit trail.

Every table except `firms` carries `firm_id`. RLS is enabled and forced on every table. There are no exceptions.

---

## Security model

This is the most important part of the system. Do not change it without understanding the implications.

### Tenancy

Every policy ultimately requires `firm_id = app.firm_id()`. The helper functions in the private `app` schema (`app.firm_id()`, `app.user_role()`, `app.is_partner()`, `app.can_see_matter()`, `app.can_write_matter()`, `app.can_see_money()`, etc.) are `SECURITY DEFINER` with a pinned `search_path` so they can read `public.users` without re-entering RLS and recursing forever. They return nothing for disabled users, which makes disabling a user take effect on their very next request.

### Matter visibility

- Partners see every matter in their firm.
- Associates see matters assigned to them plus any matter marked `firm_wide`.
- Clerks see only matters explicitly assigned to them.

Documents, diary entries and fee notes all defer to `app.can_see_matter()` and `app.can_write_matter()`, so a document cannot be more visible than the matter it belongs to. Closed matters are read-only for non-partners.

### Money

Clerks have no `select` policy on `fee_notes` or `payments`. A direct API call returns `[]`. The fee-note pages 404 for clerks.

### Storage

Both `documents` and `logos` buckets are private. Object keys are `<firm_id>/<matter_id>/<uuid>-<filename>`. Storage policies parse these segments, so a signed URL for one firm is useless to another. Signed URLs expire after ten minutes.

### Business rules in triggers

- Fee-note totals are recomputed from line items; a caller cannot post inconsistent totals.
- Approval requires a partner (or service role); associates get `42501` even if they set the column directly.
- Payment status is derived from the payments ledger; no code path sets `paid` by hand.
- Soft deletes of matters, clients and documents are partner-only.
- The activity log has only an insert policy — it is append-only.

### Pre-pilot checks

Before the pilot, run:

- `supabase/checks/rls_audit.sql` — zero rows is a pass.
- `docs/SECURITY-CHECKLIST.md` — manual cross-firm, role and storage checks.
- `docs/ACCEPTANCE-TESTS.md` — feature-by-feature validation.
- `docs/BACKUPS.md` — restore test on staging.

---

## Code style guidelines

- Use TypeScript strict mode. Run `npm run typecheck` and `npm run lint` before committing.
- Prefer Server Components and Server Actions. Client components are marked with `'use client'` only when interactivity is required (forms with `useFormState`, navigation, calendars).
- Server-only files start with `'server-only'` where appropriate.
- Use the path alias `@/*` for imports from `src/*`.
- Format money as integer KES cents everywhere; never store floats. Use `formatKes()` / `parseKesToCents()`.
- Render dates in `Africa/Nairobi` time zone with `dd/MM/yyyy` format. Store timestamps in UTC.
- Soft-delete records by setting `deleted_at`; do not hard-delete matters, clients or documents in Phase 1.
- Lists use search, filters and 25-per-page pagination (see `Pagination`, `FilterBar`).
- Tailwind classes use the custom palette (`ink-*`, `brand-*`) and the component classes in `globals.css` (`card`, `input`, `btn-primary`, etc.).
- Comments explain *why*, not what. Security-critical comments are especially important.

---

## Testing instructions

### Unit / integration tests

There are no JavaScript unit tests in this project. The rules that matter are enforced by the database and are tested there.

### Database tests

```bash
npm run test:db
```

Requirements:

- Local Postgres 15+.
- `psql` on your PATH.
- The script touches only a local throwaway database named `wakili_test` (override with `TEST_DB`).

What it does:

1. Drops and recreates the test database.
2. Applies `supabase/tests/00_local_supabase_shim.sql` to recreate the Supabase roles/functions the schema depends on.
3. Applies every migration in `supabase/migrations/`.
4. Runs `supabase/checks/rls_audit.sql`; fails if it returns any rows.
5. Runs `supabase/tests/01_policies_test.sql`, which asserts ~58 rules covering tenancy, roles, disabled users, matter closing, document soft-delete, fee-note workflow, payments, activity-log immutability and conflict-check boundaries.

### Manual acceptance testing

See `docs/ACCEPTANCE-TESTS.md`. Seed data is created with:

```bash
SEED_CONFIRM=yes node --env-file=.env.local scripts/seed.mjs
```

The seed script creates two firms so cross-tenant security checks have a real second tenant to test against. It refuses to run without `SEED_CONFIRM=yes` because it writes with the service role key.

---

## Deployment

The production target is Vercel, backed by a Supabase project.

1. Import the repo into Vercel.
2. Set the environment variables per environment. `NEXT_PUBLIC_SITE_URL` must be the real deployed URL or invitation/password-reset links will point to the wrong host.
3. In Supabase → Authentication → URL Configuration, add `https://<your-domain>/auth/callback` to the redirect allow-list.
4. Apply migrations to a staging Supabase project first, always.
5. `vercel.json` schedules `/api/cron/reminders` daily at 04:00 UTC (07:00 Nairobi). Vercel sends `CRON_SECRET` as a bearer token automatically once it is set in the project.
6. Turn on daily backups and document a restore test (`docs/BACKUPS.md`).

---

## Key conventions and gotchas

- **Server actions return `FormState`** (`{ error?, success? }`) and are bound to forms with `useFormState`.
- **Friendly DB errors** are mapped in `src/lib/forms.ts`. Unrecognised errors are passed through.
- **Matter write checks** exist in `src/lib/matters.ts` for the UI and in `app.can_write_matter()` for the database.
- **Upload validation** happens in the browser, the server action and the storage bucket.
- **Signed URL TTL** is ten minutes (`SIGNED_URL_TTL_SECONDS`).
- **The middleware** only redirects; it is not a security boundary. Real authorisation is in RLS policies.
- **`/api/documents/[id]`** looks up the document as the signed-in user and then redirects to a short-lived signed URL.
- **Cron job idempotency** relies on `diary_reminders_sent` ledger rows with a unique `(event_id, user_id, kind)` constraint.

---

## Useful references

- `README.md` — full setup, security explanation and repository layout.
- `docs/ACCEPTANCE-TESTS.md` — acceptance tests for all six features.
- `docs/SECURITY-CHECKLIST.md` — pre-pilot security checklist.
- `docs/BACKUPS.md` — daily backups and restore test.
- `docs/PILOT-PROGRESS.md` — current build status and next actions.
- `supabase/checks/rls_audit.sql` — one-query RLS health check.
- `supabase/checks/policy_inventory.sql` — every policy, listed for review.

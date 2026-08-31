# Phase 1 progress

A running record of what is built, what is verified, what is outstanding,
and the decisions taken along the way. Updated as we go, so that neither
of us has to reconstruct it from memory or scrollback.

**Last updated:** 31 August 2026

**Staging app:** https://file-management-beige.vercel.app

---

## Where things stand

| Stage | Status |
|---|---|
| Features 1–6 built | **Done** |
| Verified against a local Postgres | **Done** — 58 policy assertions, RLS audit clean |
| Verified against the real Supabase project | **Not started** — needs the schema applied |
| App deployed and reachable | **Done** — https://file-management-beige.vercel.app |
| Schema applied to staging | **Done** — signup reached the auth service, so the tables are there |
| Auth redirect URL configured | **Outstanding — you** |
| Firm A registered, partner signed in | **Done** — Kimani & Co Advocates |
| Firm B registered | **Outstanding — you** |
| Associate and clerk invited | **Outstanding — you** |
| Demo data seeded | **Outstanding — you** |
| Acceptance tests run | **Outstanding — you** |
| Security checklist run | **Outstanding — you** |
| Backup restore test | **Outstanding — you** |
| Pilot firm's files migrated | Not started (last step before launch) |

---

## Decisions taken

**Stack is as specified.** Next.js 14 App Router + TypeScript, Supabase,
Tailwind, Vercel, Resend. No deviation.

**Security lives in the database, not the application.** Every rule exists
twice — once in the interface so nobody is offered a button that will
fail, and once in a row-level security policy, which is what actually
stops a forged request. The interface is a courtesy; the policy is the
control.

**Browser-only operation, no local development.** *(31 Aug)* You have
neither Git nor Node installed, and installing them buys nothing you
need: you are the QA on this, and what you have to test is a real hosted
app — which is also what the pilot firm will use. So the app is deployed
to Vercel and everything is done in two browser tabs.

**Accounts are created through the app, not seeded.** *(31 Aug)* The
original seed script needed Node. Rewriting it to fabricate login
accounts in SQL would have meant writing untested statements against
Supabase's internal auth tables, whose shape varies by version. Instead
you register the firms and send the invitations through the app's own
screens — browser work, and it exercises Feature 1, which has to be
tested anyway. Only the business data is seeded by SQL.

**Two firms, always.** The security checklist turns on trying to reach one
firm's records while signed in as the other. That needs a real second
tenant, so both the seed and the test suite create one.

---

## What is built, and how it was checked

All six features are complete. Verification so far is against a local
Postgres carrying a stand-in for the parts of Supabase the schema leans
on — not against the real project, which this environment cannot reach.

| Feature | Built | Checked so far |
|---|---|---|
| 1. Auth, firms, users | Signup, login, invitations, roles, disable, firm settings | **Confirmed live:** firm signup, partner sign-in, role-aware navigation. Locally: disabled user refused everywhere; clerk blocked from partner-only pages |
| 2. Clients | Create/edit/view, duplicate warnings, conflict check | Conflict check finds opposing parties firm-wide, never crosses a firm |
| 3. Matters | The file, its four tabs, list filters, closing, dashboard | Associate sees only assigned + firm-wide; duplicate file reference rejected; closed file refuses non-partners |
| 4. Documents | Upload, preview, signed downloads, soft delete | Partner-only delete; signed URLs expire in 10 minutes; buckets private |
| 5. Court diary | Month and agenda views, reminders, adjournments | Clerk cannot write to the diary; reminder job is idempotent |
| 6. Fee notes | Line items, VAT, approval, payments, PDF, reports | Associate cannot approve even by setting the column; payments drive status |

**58 assertions pass** against the policies and triggers themselves.
**The RLS audit is clean.** A **fee note PDF renders** with the letterhead
and `KSh 150,000.00` formatting.

---

## Defects found and fixed during the build

Each of these was found by running the thing rather than reading it.

1. **Soft delete refused itself.** Postgres re-checks the SELECT policies
   against the row an UPDATE produces, so setting `deleted_at` made a
   record fail its own visibility policy — on documents, clients and
   matters alike.
2. **Password reset could never complete.** The middleware sent
   `/auth/callback` to the sign-in page, and that route is what grants
   the session in the first place.
3. **A trigger conflict broke every payment.** The payment trigger's own
   recomputation tripped the guard meant to stop callers setting a paid
   status by hand.
4. **The upload form depended on handler ordering** to send its files.
5. **The RLS audit would have reported a pass it never made.** It was
   eight separate queries, and the Supabase SQL editor returns only the
   last result set.
6. **The seed script's lookup was blocked by the RLS it was seeding
   through** — a chicken-and-egg the script now avoids by adopting the
   partner's identity first.
7. **A mistyped credential produced an unreadable error.** Pasting a
   dashboard's masked value — the bullets shown before you click Reveal —
   surfaced as "Cannot convert argument to a ByteString because the
   character at index 15 has a value of 8226", which names neither the
   variable at fault nor the remedy. Credentials are now checked on the
   way in, and the signup and invitation screens say which variable is
   wrong and how to re-copy it.

---

## Known and accepted

- **Email is off** until `RESEND_API_KEY` is set. Invitations and
  reminders print to the server log instead; the invite screen hands the
  partner the link directly, so the flow still works.
- **The limitation-deadline helper is arithmetic only.** It adds N years
  to a date and says on screen that the advocate must verify the period
  that actually applies.
- **The service role key has been in chat** and should be rotated once
  setup is finished.
- **One Supabase project, not two.** The build assumes staging and
  production. Only staging exists so far; production is created before
  the pilot firm is let in.

---

## Explicitly out of scope for Phase 1

Judiciary e-filing, live M-Pesa collection, document automation, trust
accounting, time tracking, AI features, native mobile apps.

---

## Next action

Yours, in order:

1. Set `NEXT_PUBLIC_SITE_URL` in Vercel to the staging URL and redeploy,
   so invitation and password-reset links are stable across deploys.
2. Supabase → Authentication → URL Configuration: set the Site URL and
   add `https://file-management-beige.vercel.app/auth/callback`.
3. Register the two firms in the app and invite an associate and a clerk.
4. Seed both firms with `supabase/seed_demo_data.sql`.
5. Run `rls_audit.sql`, then `ACCEPTANCE-TESTS.md` and
   `SECURITY-CHECKLIST.md`.

Mine: fix whatever those turn up. Note that this build environment cannot
reach either Supabase or the deployed app — its egress policy refuses
both — so everything against the live system is run by you and diagnosed
from what you paste back.

# Acceptance tests

One section per feature, in build order. A feature is not done until its
box is ticked against staging with seed data loaded.

Seed first: `node scripts/seed.mjs`. Sign-in details are in
`docs/SECURITY-CHECKLIST.md`.

---

## Feature 1 — Auth, firms and user management

- [ ] **Two firms exist and neither can see the other.** The seed creates
  Kimani & Company and Ochieng, Mwangi. Run section 1 of the security
  checklist — URL editing and direct API calls — and confirm every attempt
  comes back empty or 404.
- [ ] **A disabled user's session stops working within a minute.** Section
  8 of the security checklist. In practice it is immediate: the policies
  refuse a disabled user on their next statement.
- [ ] **A clerk cannot reach user management or settings by URL.** As
  `clerk@firma.test`, open `/users` and `/settings`. Both redirect to
  `/forbidden`.

Also worth confirming while you are here:

- [ ] Invite a colleague from `/users`. With `RESEND_API_KEY` unset the
  link is shown on screen instead of emailed; either way, open it, set a
  password, and land on the dashboard in the right role.
- [ ] Change someone's role and confirm the navigation they see changes.

## Feature 2 — Clients

- [ ] **A client whose name matches an opposing party raises a conflict
  warning naming the matter.** As `partner@firma.test`, start a new client
  and type `Kenya Power`. A red conflict panel appears naming
  `KM/CIV/045/<year>` — the Wanjiku matter — and links to it.
- [ ] **A clerk sees contact details but no financial section.** As
  `clerk@firma.test`, open a client profile. Contact details show; there is
  no "Outstanding fee notes" section anywhere on the page.

Also:

- [ ] Create a client with ID number `21458796` (Mary Wanjiku's). A
  duplicate warning appears and links to her record.
- [ ] Search `/clients` by phone number and by ID number.

## Feature 3 — Matters

- [ ] **An associate sees only assigned plus firm-wide matters, in every
  list, search and dashboard count.** Sign in as `associate@firma.test`.
  They are assigned `KM/CIV/045`; `KM/CONV/012` is firm-wide;
  `KM/EMP/003` is `associate2`'s and assigned-only. Confirm:
  - `/matters` lists the first two and not the third;
  - searching for "Mwendwa" (the third matter's client) returns nothing;
  - `/matters/<KM/EMP/003 id>` 404s;
  - the dashboard's counts do not include it.
- [ ] **A duplicate file reference is rejected with a clear message.**
  Open a matter with file reference `KM/CIV/045/<year>`. You get
  "That file reference is already used by another matter in this firm."
- [ ] **A closed matter rejects new documents and diary entries from
  non-partners.** As `associate@firma.test`, open the closed succession
  matter. The upload form and the "New entry" button are absent, and the
  page says the file is read-only. As a partner, both work.

## Feature 4 — Documents

- [ ] **A document URL from Firm A fails while signed in as Firm B.**
  Copy `/api/documents/<id>` from Firm A, sign in as `partner@firmb.test`,
  open it. 404.
- [ ] **A signed download URL stops working after expiry.** Download a
  document, copy the signed storage URL you land on, wait eleven minutes,
  open it again. It fails; the app signs for ten minutes.
- [ ] **A 30 MB upload is rejected with a friendly error.** Make one:
  ```bash
  head -c 31457280 /dev/urandom > big.pdf
  ```
  Choose it. The message names the file, its size and the 25 MB limit, and
  nothing is uploaded.

Also:

- [ ] Upload two files at once and confirm both appear with the category
  you chose.
- [ ] Preview a PDF and an image in-browser.
- [ ] As a partner, delete a document; confirm it disappears from the list
  and that the row still exists with `deleted_at` set.
- [ ] Confirm the Activity tab records the view and the download.

## Feature 5 — Court diary and deadlines

- [ ] **Reminder emails arrive at 7, 3 and 1 days.** Rather than waiting a
  week, drive the endpoint at a date of your choosing:
  ```bash
  # A hearing is seeded three days out; ask for the run as if it were
  # seven days before that hearing.
  curl -s "$SITE/api/cron/reminders?date=<hearing date minus 7 days>" \
    -H "Authorization: Bearer $CRON_SECRET" | jq
  ```
  The response reports `lead_reminders_sent`. Repeat with minus 3 and
  minus 1 days. Check the inbox — or, with `RESEND_API_KEY` unset, the
  server log, where the message body is printed in full. Run the same
  command twice and confirm the second run sends nothing: the
  `diary_reminders_sent` ledger makes it idempotent.
- [ ] **The 07:00 digest arrives.** `curl` the endpoint with today's date
  and confirm `digests_sent` is at least 1 for a user with entries today.
- [ ] **An adjourned hearing is rescheduled in two clicks, preserving
  history.** On a hearing, click **Record outcome**, tick **Adjourned**,
  type the outcome and the new date, save. The original stays on its own
  date marked *Adjourned* with the outcome attached, and a new entry
  appears on the new date.
- [ ] **A clerk sees the diary but no fee-note data.** As
  `clerk@firma.test`, open `/diary`. Entries on their matters are visible;
  there is no "New entry" button, no money anywhere, and no Fee notes tab
  on any matter.

## Feature 6 — Fee notes and payments

- [ ] **An associate can draft but cannot approve, including by direct API
  call.** As `associate@firma.test`, raise a fee note — the Approve button
  is not rendered. Then try it directly:
  ```bash
  curl -s -X PATCH "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/fee_notes?id=eq.<draft id>" \
    -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer <associate access token>" \
    -H "Content-Type: application/json" \
    -d '{"status":"approved"}'
  # Expected: an error, "only a partner can approve a fee note".
  ```
  Confirm the row is still `draft`.
- [ ] **Payments summing to the total flip the status to Paid.** On a sent
  fee note, record a part payment — status becomes *Partially paid*.
  Record the balance — status becomes *Paid* without anyone setting it.
- [ ] **The PDF renders with the firm logo and KES formatting.** Upload a
  logo in `/settings`, then download a fee note PDF. The logo is on the
  letterhead above the firm name and address, and amounts read
  `KSh 150,000.00`.

Also:

- [ ] Confirm numbering runs `FN-<year>-0001`, `FN-<year>-0002`, per firm.
- [ ] Confirm line items cannot be edited after approval.
- [ ] As a partner, check `/reports`: unpaid list, totals by client and by
  matter, and the billed/received figures for the month.

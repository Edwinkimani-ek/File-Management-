# Pre-pilot security checklist

The owner performs this personally, against **staging first** and then
against **production**, and does not hand the system to the pilot firm
until every box is ticked.

Seed both environments with `node scripts/seed.mjs` first — it creates two
firms precisely so that the cross-tenant checks below have a second tenant
to attack. It prints the ids you will need.

Sign-in details after seeding (password `Wakili-Demo-2026` unless you set
`SEED_PASSWORD`):

| Firm | Role | Email |
|---|---|---|
| Kimani & Company | Partner | `partner@firma.test` |
| Kimani & Company | Associate | `associate@firma.test` |
| Kimani & Company | Associate (other files) | `associate2@firma.test` |
| Kimani & Company | Clerk | `clerk@firma.test` |
| Ochieng, Mwangi | Partner | `partner@firmb.test` |

---

## [ ] 1. Cross-firm access fails on every entity type

Sign in as `partner@firma.test`. For each Firm B id the seed printed, try
to reach it by editing the URL directly. Every one must 404 — not show an
empty page, not show the record.

| Entity | URL to try | Expected |
|---|---|---|
| Matter | `/matters/<firm B matter id>` | 404 |
| Client | `/clients/<firm B client id>` | 404 |
| Fee note | `/fee-notes/<firm B fee note id>` | 404 |
| Document | `/api/documents/<firm B document id>` | 404 JSON |
| Fee note PDF | `/api/fee-notes/<firm B fee note id>/pdf` | 404 JSON |

Then try it at the API layer, which is where a real attacker would go.
Copy your `sb-…-auth-token` cookie value out of the browser, or grab an
access token, and call PostgREST directly:

```bash
# Firm A's access token, Firm B's matter id.
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/matters?id=eq.<firm B matter id>" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer <firm A access token>"
# Expected: []
```

Repeat for `clients`, `documents`, `diary_events`, `fee_notes`,
`payments`, `users`, `activity_log`. Every one must return `[]`.

Now try to **write** across the boundary, which is the check people skip:

```bash
curl -s -X PATCH "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/matters?id=eq.<firm B matter id>" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer <firm A access token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"tampered"}'
# Expected: [] and the row unchanged in Firm B.
```

## [ ] 2. Row-level security is enabled on every table

Paste `supabase/checks/rls_audit.sql` into the SQL editor and run it. It
is deliberately one query — the editor shows only the last result set, so
a file of separate SELECTs would hide all but the final check.

**Zero rows is a pass.** Any row names the table or policy at fault and
why it matters. `supabase/checks/policy_inventory.sql` lists every policy
in full, which is worth reading through once before the pilot.

Also run Supabase's own linter: **Advisors → Security Advisor**. Resolve
anything it raises about RLS or exposed schemas.

## [ ] 3. The clerk role is tested against every partner-only screen

Sign in as `clerk@firma.test` and type each of these URLs directly. Nothing
here may be reachable by knowing the address.

| URL | Expected |
|---|---|
| `/users` | redirected to `/forbidden` |
| `/settings` | redirected to `/forbidden` |
| `/reports` | redirected to `/forbidden` |
| `/fee-notes` | 404 |
| `/fee-notes/<a real Firm A fee note id>` | 404 |
| `/matters/<matter they are on>/fee-notes` | 404 |
| `/clients/<a Firm A client>` | loads, with **no** financial section |

And at the API layer, as the clerk:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/fee_notes?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer <clerk access token>"
# Expected: []

curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/payments?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer <clerk access token>"
# Expected: []
```

A clerk must also see only the matters assigned to them — not firm-wide
ones. Confirm `/matters` shows only their own files.

## [ ] 4. Storage buckets are private; an unsigned URL is a 403

```bash
# Take a storage_path from public.documents and hit it without a signature.
curl -si "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/public/documents/<storage_path>"
# Expected: 400/403, never the file.
```

Then check the expiry, which is the part that actually protects a URL that
has been forwarded on:

1. In the app, open a document's **Download**. Copy the signed URL you land
   on out of the address bar.
2. Confirm it works.
3. Wait eleven minutes. Open it again. It must fail — the app signs for ten
   minutes.

Confirm in the dashboard that **Storage → documents** and **Storage →
logos** both show as *Private*.

## [ ] 5. Backup restore test completed on staging

See `docs/BACKUPS.md`. Do the restore, write down the result, then tick.

## [ ] 6. The activity log captures downloads and approvals

As a partner, download a document and approve a fee note, then:

```sql
select action, entity_type, detail, created_at
from public.activity_log
where action in ('document.downloaded', 'document.viewed', 'fee_note.approved')
order by created_at desc limit 20;
```

Both must be there, with the acting user. Confirm from the app too: the
matter's **Activity** tab shows them.

Also confirm the log cannot be rewritten — there is no update or delete
policy on it, so this must fail:

```bash
curl -s -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/activity_log?id=eq.<some id>" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer <partner access token>"
# Expected: the row is still there.
```

## [ ] 7. Password reset works and old sessions die

1. Sign in as `associate@firma.test` in Chrome. Leave it signed in.
2. In a second browser (or a private window), go to **Forgot password**
   and request a reset for the same address.
3. Follow the link, set a new password.
4. Return to Chrome and click anything. You must be bounced to `/login` —
   the reset ends every other session for that user.
5. Confirm the old password no longer signs in, and the new one does.

## [ ] 8. A disabled user loses access immediately

1. Sign in as `associate@firma.test` in one browser.
2. As `partner@firma.test` in another, set that user to **Disabled**.
3. In the first browser, click anything. Expect an immediate bounce to
   `/login`: the security helpers return nothing for a disabled user, so
   every policy refuses them on their very next statement — this does not
   wait for the token to expire.
4. Confirm they cannot sign back in.

---

## Sign-off

| Item | Environment | Date | Checked by |
|---|---|---|---|
| 1. Cross-firm access | staging / production | | |
| 2. RLS everywhere | staging / production | | |
| 3. Clerk role | staging / production | | |
| 4. Private storage | staging / production | | |
| 5. Restore test | staging | | |
| 6. Activity log | staging / production | | |
| 7. Password reset | staging / production | | |
| 8. Disabled user | staging / production | | |

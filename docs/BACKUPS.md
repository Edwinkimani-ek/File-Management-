# Backups and restore

Nothing in this document is optional before the pilot. A law firm's files
are its practice; losing them is not a bug, it is a professional
liability.

## Daily automated backups

Supabase takes them, per project:

1. Open the project → **Database → Backups**.
2. Confirm **Daily backups** is on. On the free tier this gives you seven
   days of daily backups; on Pro it is Point-in-Time Recovery, which is
   what the production project should be on before the pilot firm puts
   live files in it.
3. Note the backup window. It runs in UTC; 02:00 UTC is 05:00 in Nairobi,
   which is before the firm starts work.

Storage objects — every uploaded document — are **not** covered by the
database backup. Take a weekly copy of the `documents` bucket as well:

```bash
# Requires the Supabase CLI, logged in and linked to the project.
supabase storage cp -r ss://documents ./backup-documents-$(date +%F) \
  --experimental
```

Keep those copies somewhere the Supabase project cannot reach — a
different cloud account, or an encrypted external disk held at the firm.
A backup that a compromised project can delete is not a backup.

## Restore test — do this once, on staging, before pilot launch

The checklist item is "backup restore test completed successfully on
staging", and the only way to complete it is to actually do it.

1. **Take a fresh backup of staging.** Database → Backups → *Backup now*,
   or wait for the daily one and note its timestamp.
2. **Break something deliberately.** In the SQL editor:
   ```sql
   -- Pick a real matter id from your seed data.
   select id, file_reference, title from public.matters limit 5;
   delete from public.matters where id = '<the id you picked>';
   ```
   Confirm it is gone from the app.
3. **Restore.** Database → Backups → *Restore* the backup from step 1.
   Supabase restores into the same project; the app will be unavailable
   for a few minutes.
4. **Verify.** Sign in and confirm:
   - the matter you deleted is back, with its file reference and title;
   - its documents still open (this proves the storage objects and the
     `documents` rows still line up);
   - `select count(*) from public.activity_log;` is close to what it was.
5. **Write down** the date, who ran it, how long the restore took, and
   anything that did not come back. Tick the checklist item only after
   this is written down.

Repeat the test after any change to the schema that is large enough to
worry you.

## Before touching the production database

The build rule is absolute: **never modify the production database
without a fresh backup.** In practice that means, every time:

1. Database → Backups → *Backup now*. Wait for it to complete.
2. Run your change inside a transaction and read the row counts before
   committing:
   ```sql
   begin;
   -- your change
   select count(*) from public.matters;  -- sanity check
   commit;  -- or: rollback;
   ```
3. Migrations go to staging first, always. A migration that has not run
   against staging does not run against production.

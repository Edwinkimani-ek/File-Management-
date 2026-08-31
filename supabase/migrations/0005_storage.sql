-- =====================================================================
-- Private storage buckets.
--
-- Object keys are  <firm_id>/<matter_id>/<uuid>-<filename>  so the first
-- path segment carries the tenant and the second carries the matter. The
-- policies below read those segments back, which means a signed URL
-- minted for Firm A is useless to Firm B and an unsigned URL is a 403.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 26214400,   -- 25 MB
  array['application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Firm logos. Also private; the app serves them through signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', false, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = false;

drop policy if exists documents_read   on storage.objects;
drop policy if exists documents_write  on storage.objects;
drop policy if exists documents_delete on storage.objects;
drop policy if exists logos_read       on storage.objects;
drop policy if exists logos_write      on storage.objects;

create policy documents_read on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = app.firm_id()::text
  and app.can_see_matter(((storage.foldername(name))[2])::uuid)
);

create policy documents_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = app.firm_id()::text
  and app.can_write_matter(((storage.foldername(name))[2])::uuid)
);

create policy documents_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = app.firm_id()::text
  and app.is_partner()
);

create policy logos_read on storage.objects for select to authenticated
using (bucket_id = 'logos' and (storage.foldername(name))[1] = app.firm_id()::text);

create policy logos_write on storage.objects for all to authenticated
using (bucket_id = 'logos' and (storage.foldername(name))[1] = app.firm_id()::text
       and app.is_partner())
with check (bucket_id = 'logos' and (storage.foldername(name))[1] = app.firm_id()::text
            and app.is_partner());

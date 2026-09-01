-- =====================================================================
-- Private storage bucket for .docx templates.
-- Object keys: <firm_id>/<uuid>-<filename>
-- Read access is firm-wide (associates generate documents from templates);
-- write and delete are partner-only.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'templates', 'templates', false, 26214400,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists templates_read  on storage.objects;
drop policy if exists templates_write on storage.objects;
drop policy if exists templates_delete on storage.objects;

create policy templates_read on storage.objects for select to authenticated
using (
  bucket_id = 'templates'
  and (storage.foldername(name))[1] = app.firm_id()::text
);

create policy templates_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'templates'
  and (storage.foldername(name))[1] = app.firm_id()::text
  and app.is_partner()
);

create policy templates_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'templates'
  and (storage.foldername(name))[1] = app.firm_id()::text
  and app.is_partner()
);

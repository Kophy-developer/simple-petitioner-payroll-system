insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'receipts',
    'receipts',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ),
  (
    'logos',
    'logos',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
  ),
  (
    'validity-uploads',
    'validity-uploads',
    false,
    20971520,
    array[
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]
  )
on conflict (id) do nothing;

create policy receipts_select on storage.objects
for select to authenticated
using (
  bucket_id = 'receipts'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.is_admin_plus()
  )
);

create policy receipts_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy receipts_update on storage.objects
for update to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy logos_select on storage.objects
for select to authenticated
using (bucket_id = 'logos');

create policy logos_write on storage.objects
for all to authenticated
using (bucket_id = 'logos' and private.is_admin_plus())
with check (bucket_id = 'logos' and private.is_admin_plus());

create policy validity_uploads_select on storage.objects
for select to authenticated
using (
  bucket_id = 'validity-uploads'
  and (
    private.is_admin_plus()
    or private.current_role() = 'validator'
  )
);

create policy validity_uploads_write on storage.objects
for all to authenticated
using (
  bucket_id = 'validity-uploads'
  and (
    private.is_admin_plus()
    or private.current_role() = 'validator'
  )
)
with check (
  bucket_id = 'validity-uploads'
  and (
    private.is_admin_plus()
    or private.current_role() = 'validator'
  )
);

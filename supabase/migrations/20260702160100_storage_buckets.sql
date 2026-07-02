insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('logos', 'logos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('validity-uploads', 'validity-uploads', false, 20971520, array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'])
on conflict (id) do nothing;

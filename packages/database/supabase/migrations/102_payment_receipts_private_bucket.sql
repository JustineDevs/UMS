-- Payment receipts contain financial and personal data. Keep the bucket private;
-- the storefront service role is the only path that creates short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists payment_receipts_storage_public_read on storage.objects;
drop policy if exists payment_receipts_storage_anon_insert on storage.objects;

drop policy if exists payment_receipts_storage_service_all on storage.objects;
create policy payment_receipts_storage_service_all
  on storage.objects for all
  to service_role
  using (bucket_id = 'payment-receipts')
  with check (bucket_id = 'payment-receipts');

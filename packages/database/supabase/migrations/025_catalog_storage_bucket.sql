-- Public catalog media bucket (product images and gallery videos served via Supabase CDN).
-- Uploads use the service role from admin API; anon reads objects for storefront URLs.

insert into storage.buckets (id, name, public)
values ('catalog', 'catalog', true)
on conflict (id) do nothing;

drop policy if exists catalog_storage_objects_read_anon on storage.objects;
create policy catalog_storage_objects_read_anon on storage.objects
  for select to anon
  using (bucket_id = 'catalog');

drop policy if exists catalog_storage_objects_read_auth on storage.objects;
create policy catalog_storage_objects_read_auth on storage.objects
  for select to authenticated
  using (bucket_id = 'catalog');

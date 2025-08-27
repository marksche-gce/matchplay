-- Create public storage bucket for header images (idempotent)
insert into storage.buckets (id, name, public)
values ('header-images', 'header-images', true)
on conflict (id) do nothing;

-- Allow public read access to files in the header-images bucket
create policy if not exists "Public read access to header-images"
  on storage.objects
  for select
  using (bucket_id = 'header-images');

-- Allow authenticated users to upload new header images
create policy if not exists "Authenticated users can upload header images"
  on storage.objects
  for insert
  with check (bucket_id = 'header-images' and auth.role() = 'authenticated');

-- Allow authenticated users to update their header images
create policy if not exists "Authenticated users can update header images"
  on storage.objects
  for update
  using (bucket_id = 'header-images' and auth.role() = 'authenticated');

-- Optionally allow authenticated users to delete header images
create policy if not exists "Authenticated users can delete header images"
  on storage.objects
  for delete
  using (bucket_id = 'header-images' and auth.role() = 'authenticated');
-- Public media bucket for profile avatars and check-in photos.
-- Object paths are scoped to the profile/user id as the first folder segment.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hoppin-media',
  'hoppin-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists hoppin_media_select_public on storage.objects;
create policy hoppin_media_select_public on storage.objects
  for select
  using (bucket_id = 'hoppin-media');

drop policy if exists hoppin_media_insert_owner on storage.objects;
create policy hoppin_media_insert_owner on storage.objects
  for insert
  with check (
    bucket_id = 'hoppin-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists hoppin_media_update_owner on storage.objects;
create policy hoppin_media_update_owner on storage.objects
  for update
  using (
    bucket_id = 'hoppin-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'hoppin-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists hoppin_media_delete_owner on storage.objects;
create policy hoppin_media_delete_owner on storage.objects
  for delete
  using (
    bucket_id = 'hoppin-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

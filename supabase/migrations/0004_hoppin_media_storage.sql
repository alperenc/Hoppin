-- Media buckets for profile avatars and protected check-in photos.
-- Object paths are scoped to the profile/user id as the first folder segment.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hoppin-avatars',
  'hoppin-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hoppin-checkins',
  'hoppin-checkins',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove the first-draft combined bucket policies if they were applied.
drop policy if exists hoppin_media_select_public on storage.objects;
drop policy if exists hoppin_media_insert_owner on storage.objects;
drop policy if exists hoppin_media_update_owner on storage.objects;
drop policy if exists hoppin_media_delete_owner on storage.objects;

drop policy if exists hoppin_avatars_select_public on storage.objects;
create policy hoppin_avatars_select_public on storage.objects
  for select
  using (bucket_id = 'hoppin-avatars');

drop policy if exists hoppin_avatars_insert_owner on storage.objects;
create policy hoppin_avatars_insert_owner on storage.objects
  for insert
  with check (
    bucket_id = 'hoppin-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists hoppin_avatars_update_owner on storage.objects;
create policy hoppin_avatars_update_owner on storage.objects
  for update
  using (
    bucket_id = 'hoppin-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'hoppin-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists hoppin_avatars_delete_owner on storage.objects;
create policy hoppin_avatars_delete_owner on storage.objects
  for delete
  using (
    bucket_id = 'hoppin-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists hoppin_checkins_select_visible on storage.objects;
create policy hoppin_checkins_select_visible on storage.objects
  for select
  using (
    bucket_id = 'hoppin-checkins'
    and exists (
      select 1
      from public.checkins c
      where c.profile_id::text = (storage.foldername(name))[1]
        and name = any(c.photo_urls)
        and (
          c.profile_id = auth.uid()
          or c.privacy = 'public'
          or (
            c.privacy = 'followers'
            and exists (
              select 1
              from public.follows f
              where f.follower_id = auth.uid()
                and f.following_id = c.profile_id
            )
          )
        )
    )
  );

drop policy if exists hoppin_checkins_insert_owner on storage.objects;
create policy hoppin_checkins_insert_owner on storage.objects
  for insert
  with check (
    bucket_id = 'hoppin-checkins'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists hoppin_checkins_update_owner on storage.objects;
create policy hoppin_checkins_update_owner on storage.objects
  for update
  using (
    bucket_id = 'hoppin-checkins'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'hoppin-checkins'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists hoppin_checkins_delete_owner on storage.objects;
create policy hoppin_checkins_delete_owner on storage.objects
  for delete
  using (
    bucket_id = 'hoppin-checkins'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

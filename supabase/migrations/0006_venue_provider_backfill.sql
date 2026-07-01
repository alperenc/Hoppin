-- Allow backfilling provider link on venues matched by name only
-- place_provider is not null default 'google' (0001_hoppin_core.sql), so only
-- provider_place_id is a meaningful null/not-null signal for "unlinked".

drop policy if exists venues_attach_provider on public.venues;
create policy venues_attach_provider on public.venues
  for update
  using (auth.role() = 'authenticated' and provider_place_id is null)
  with check (auth.role() = 'authenticated' and provider_place_id is not null);

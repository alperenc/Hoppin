-- Allow backfilling provider link on venues matched by name only

drop policy if exists venues_attach_provider on public.venues;
create policy venues_attach_provider on public.venues
  for update
  using (auth.role() = 'authenticated' and place_provider is null and provider_place_id is null)
  with check (auth.role() = 'authenticated' and place_provider is not null and provider_place_id is not null);

-- Restrict venue updates to the columns each policy actually needs, and add
-- a policy that lets a confirmed provider match refresh stale name/coordinates.

revoke update on table public.venues from authenticated;
grant update (name, place_provider, provider_place_id, latitude, longitude) on table public.venues to authenticated;

drop policy if exists venues_refresh_provider_match on public.venues;
create policy venues_refresh_provider_match on public.venues
  for update
  using (auth.role() = 'authenticated' and place_provider is not null and provider_place_id is not null)
  with check (auth.role() = 'authenticated' and place_provider is not null and provider_place_id is not null);

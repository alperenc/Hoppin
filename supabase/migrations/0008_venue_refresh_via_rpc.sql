-- venues_refresh_provider_match authorized any authenticated user to rewrite
-- name/latitude/longitude on ANY already-linked venue, because RLS can only
-- see row state (is this venue linked?), not caller intent (is this venue
-- relevant to what this caller is doing?). findOrCreateVenue resolves a
-- venue before the check-in referencing it exists, so there is no row to
-- join against for an ownership check. Route the refresh through a
-- SECURITY DEFINER function instead: it re-confirms the exact
-- (place_provider, provider_place_id) identity match server-side before
-- writing, so a caller can only ever refresh a venue they can already prove
-- they resolved via that same provider hint -- not an arbitrary venue id.

drop policy if exists venues_refresh_provider_match on public.venues;

revoke update (name, latitude, longitude) on table public.venues from authenticated;

create or replace function public.refresh_venue_from_provider_hint(
  p_venue_id uuid,
  p_place_provider text,
  p_provider_place_id text,
  p_name text,
  p_latitude double precision,
  p_longitude double precision
)
returns public.venues
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue public.venues;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'refresh_venue_from_provider_hint: authentication required';
  end if;

  update public.venues
  set
    name = coalesce(p_name, name),
    latitude = coalesce(p_latitude, latitude),
    longitude = coalesce(p_longitude, longitude)
  where id = p_venue_id
    and place_provider = p_place_provider
    and provider_place_id = p_provider_place_id
  returning * into v_venue;

  if v_venue.id is null then
    raise exception 'refresh_venue_from_provider_hint: no matching linked venue for that provider hint';
  end if;

  return v_venue;
end;
$$;

grant execute on function public.refresh_venue_from_provider_hint(uuid, text, text, text, double precision, double precision) to authenticated;

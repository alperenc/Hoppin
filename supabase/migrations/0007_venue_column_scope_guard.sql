-- venues_attach_provider (0006) let any authenticated client set
-- place_provider/provider_place_id on any unlinked venue, with no check that
-- the chosen place_id had any real relationship to that specific venue. An
-- attacker could attach an arbitrary Google place to a venue other users'
-- check-ins/trails already reference, then trigger the refresh endpoint to
-- overwrite the venue's real name/coordinates with that unrelated place's
-- data. RLS can only see row state (is this venue linked?), never whether
-- the caller's chosen place_id is genuine or geographically related to the
-- venue -- that can only be established against Google's own API, and only
-- server-side, since venues_select_all (0001/0002) makes every venue column
-- public row data no client-suppliable value can prove intent against.
--
-- Remove all client UPDATE access to public.venues. Linking an unlinked
-- venue and refreshing a linked venue's stale name/coordinates both happen
-- exclusively through a server-side Vercel function (api/places-refresh.ts)
-- that re-verifies the place_id against the Google Places API, requires the
-- claimed place to be within a plausible distance of the venue's existing
-- location before ever attaching a link, and writes with the Supabase
-- service-role key.

drop policy if exists venues_attach_provider on public.venues;

revoke update on table public.venues from authenticated;

create or replace function public.venues_enforce_server_only_writes()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'venues: name/latitude/longitude/place_provider/provider_place_id are not client-writable';
  end if;
  return new;
end;
$$;

drop trigger if exists venues_enforce_column_scope on public.venues;
drop trigger if exists venues_enforce_server_only_writes on public.venues;
create trigger venues_enforce_server_only_writes
  before update of name, latitude, longitude, place_provider, provider_place_id on public.venues
  for each row
  execute function public.venues_enforce_server_only_writes();

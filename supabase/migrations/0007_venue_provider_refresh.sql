-- Restrict venue updates to the columns each policy actually needs, and add
-- a policy that lets a confirmed provider match refresh stale name/coordinates.
--
-- Column grants are table-wide in Postgres, not scoped per policy, so any
-- policy that admits a row can write any granted column on it. venues_attach_
-- provider (0006) only ever needs place_provider/provider_place_id; the new
-- refresh policy below only ever needs name/latitude/longitude. Granting the
-- union of both to every row would let an already-linked venue's row (which
-- only the refresh policy should touch) have its provider identity rewritten
-- via the same grant, so the two column sets stay disjoint here.

revoke update on table public.venues from authenticated;
grant update (name, latitude, longitude, place_provider, provider_place_id) on table public.venues to authenticated;

drop policy if exists venues_refresh_provider_match on public.venues;
create policy venues_refresh_provider_match on public.venues
  for update
  using (auth.role() = 'authenticated' and place_provider is not null and provider_place_id is not null)
  with check (auth.role() = 'authenticated' and place_provider is not null and provider_place_id is not null);

create or replace function public.venues_enforce_column_scope()
returns trigger
language plpgsql
as $$
begin
  if old.provider_place_id is null then
    -- Row is being touched via venues_attach_provider: only the provider
    -- link may change, never name/latitude/longitude.
    if new.name is distinct from old.name
      or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude
    then
      raise exception 'venues: name/latitude/longitude cannot change on an unlinked-venue update';
    end if;
  else
    -- Row is being touched via venues_refresh_provider_match: provider
    -- identity is already confirmed and must not be reassigned.
    if new.place_provider is distinct from old.place_provider
      or new.provider_place_id is distinct from old.provider_place_id
    then
      raise exception 'venues: provider identity cannot change on a linked-venue update';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists venues_enforce_column_scope on public.venues;
create trigger venues_enforce_column_scope
  before update on public.venues
  for each row
  execute function public.venues_enforce_column_scope();

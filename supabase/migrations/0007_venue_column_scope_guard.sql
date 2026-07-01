-- venues_attach_provider (0006) grants authenticated clients UPDATE on
-- place_provider/provider_place_id via the table's default privileges, since
-- 0006 added no column-level grant. Postgres column grants are table-wide,
-- not scoped per policy, so any future policy admitting a row could write
-- any granted column on it unless the grant list itself stays narrow. Pin
-- the client grant to exactly what venues_attach_provider needs, and add a
-- trigger that additionally enforces, per row, that a client update to an
-- unlinked venue can only ever set the provider link, never rename or move
-- it -- there is no legitimate reason for a bare provider-link write to also
-- change identity fields.
--
-- name/latitude/longitude are never client-writable: syncing them from a
-- fresh Google Places lookup happens only through a server-side Vercel
-- function (api/places-refresh.ts) that re-verifies the place_id against
-- Google directly and writes with the Supabase service-role key. RLS can
-- only see row state (is this venue linked?), not caller intent (is this
-- venue relevant to what this caller is doing?), and venues_select_all
-- (0001/0002) makes place_provider/provider_place_id public row data, so no
-- client-suppliable value can ever prove legitimate intent to touch another
-- venue's identity fields -- that trust can only be established server-side,
-- against Google's own API.

revoke update on table public.venues from authenticated;
grant update (place_provider, provider_place_id) on table public.venues to authenticated;

create or replace function public.venues_enforce_column_scope()
returns trigger
language plpgsql
as $$
begin
  -- Triggers fire regardless of RLS/BYPASSRLS, so the server-side refresh
  -- path (api/places-refresh.ts, connecting with the service-role key) must
  -- be explicitly exempted here or its legitimate writes would be blocked
  -- the same as an authenticated client's would be.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.name is distinct from old.name
    or new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude
  then
    raise exception 'venues: name/latitude/longitude are not client-writable';
  end if;
  return new;
end;
$$;

drop trigger if exists venues_enforce_column_scope on public.venues;
create trigger venues_enforce_column_scope
  before update on public.venues
  for each row
  execute function public.venues_enforce_column_scope();

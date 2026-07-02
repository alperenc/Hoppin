-- Regression coverage for GitHub issue #44: PR #43 spent 4 review rounds
-- closing every way a client could write public.venues.name/latitude/
-- longitude/place_provider/provider_place_id (an unsatisfiable RLS
-- condition, a column-scope gap, a publicly-readable "identity" check, a
-- policy with no proximity validation). The final state
-- (supabase/migrations/0007_venue_column_scope_guard.sql) is:
--   - no client UPDATE grant on public.venues at all
--   - a BEFORE UPDATE OF ... trigger (venues_enforce_server_only_writes) as
--     a defense-in-depth backstop that only allows service_role writes
-- This file asserts both layers hold, for both the `authenticated` and
-- `anon` roles, and that service_role (the role api/places-refresh.ts uses)
-- can still write.
--
-- Run with: npm run test:db  (requires local Docker; see supabase/config.toml)
--
-- NOTE on the grant below: this repo's migrations have only ever been
-- applied through the hosted Supabase dashboard SQL editor (which runs as
-- `supabase_admin`, holding a permissive default ACL for new `public`
-- tables). The Supabase CLI's local/test stack applies the same migrations
-- as plain `postgres`, which -- as of the CLI/Postgres image versions this
-- repo currently pulls -- has a *restrictive* default ACL for `public`
-- (verified locally: service_role gets no SELECT/INSERT on tables it
-- doesn't explicitly own, even though it always has BYPASSRLS). That means
-- a bare local/CI run of these migrations would leave service_role unable
-- to read/write public.venues at all, which has nothing to do with the RLS
-- guard this file tests and would otherwise make every service_role
-- assertion below fail for an environment-identity reason, not a real
-- regression. Grant explicitly here, test-fixture-local, to isolate that
-- concern; a follow-up issue should confirm whether the hosted project
-- needs an equivalent explicit grant or is already covered via
-- supabase_admin-applied defaults.

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

-- ---------------------------------------------------------------------
-- Fixtures (as postgres/service context, bypassing RLS entirely)
-- ---------------------------------------------------------------------

grant select, insert, update, delete on public.venues, public.cities to service_role;

-- public.venues is publicly readable by design (venues_select_all policy,
-- migrations 0001/0002): grant SELECT to authenticated/anon here too, so
-- test 4 below (temporary re-grant of UPDATE) can locate the row via its
-- WHERE clause the same way it would against the hosted project, rather
-- than failing on a SELECT permission error that has nothing to do with
-- the trigger this test is actually exercising.
grant select on public.venues to authenticated, anon;

insert into public.cities (id, city, country, latitude, longitude)
values ('00000000-0000-0000-0000-0000000000c1', 'Test City', 'Test Country', 40.7128, -74.0060);

insert into public.venues (id, name, city_id, country, place_provider, provider_place_id, latitude, longitude)
values (
  '00000000-0000-0000-0000-0000000000e1',
  'Original Venue Name',
  '00000000-0000-0000-0000-0000000000c1',
  'Test Country',
  'google',
  'places/original-place-id',
  40.7128,
  -74.0060
);

-- ---------------------------------------------------------------------
-- 1. No client UPDATE grant at all on public.venues (table-level, applies
--    regardless of RLS policy content or row match).
-- ---------------------------------------------------------------------

select is(
  has_table_privilege('authenticated', 'public.venues', 'UPDATE'),
  false,
  'authenticated role has no UPDATE grant on public.venues'
);

select is(
  has_table_privilege('anon', 'public.venues', 'UPDATE'),
  false,
  'anon role has no UPDATE grant on public.venues'
);

select is(
  has_table_privilege('service_role', 'public.venues', 'UPDATE'),
  true,
  'service_role retains UPDATE grant on public.venues (server-only write path)'
);

-- ---------------------------------------------------------------------
-- 2. Attempting a guarded-column UPDATE as `authenticated` fails outright
--    at the grant level (permission denied), before RLS or the trigger
--    even run.
-- ---------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}';

select throws_ok(
  $$ update public.venues set name = 'Hijacked Name' where id = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501',
  null,
  'authenticated UPDATE on venues.name is denied (no UPDATE grant)'
);

select throws_ok(
  $$ update public.venues set latitude = 0, longitude = 0 where id = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501',
  null,
  'authenticated UPDATE on venues.latitude/longitude is denied (no UPDATE grant)'
);

select throws_ok(
  $$ update public.venues set place_provider = 'osm', provider_place_id = 'fake' where id = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501',
  null,
  'authenticated UPDATE on venues.place_provider/provider_place_id is denied (no UPDATE grant)'
);

reset role;

-- ---------------------------------------------------------------------
-- 3. Same for `anon` (unauthenticated).
-- ---------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ update public.venues set name = 'Hijacked Name' where id = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501',
  null,
  'anon UPDATE on venues.name is denied (no UPDATE grant)'
);

select throws_ok(
  $$ update public.venues set latitude = 0, longitude = 0 where id = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501',
  null,
  'anon UPDATE on venues.latitude/longitude is denied (no UPDATE grant)'
);

reset role;

-- ---------------------------------------------------------------------
-- 4. Defense-in-depth: even if a future migration re-opens client UPDATE
--    access (the exact regression class this issue guards against -- PR
--    #43's history includes a too-permissive RLS policy stacked with a
--    grant), the venues_enforce_server_only_writes trigger independently
--    blocks any non-service_role write to the guarded columns. Simulate
--    the hole being reopened with both a GRANT and a permissive RLS
--    policy (a grant alone would just leave RLS's default-deny filtering
--    the UPDATE to zero matched rows, never reaching the trigger, which
--    would not actually exercise this backstop) -- the trigger, not the
--    grant/policy, must be what stops the write.
-- ---------------------------------------------------------------------

grant update on table public.venues to authenticated;
create policy venues_update_reopened_for_test on public.venues
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}';

select throws_like(
  $$ update public.venues set name = 'Hijacked Via Grant' where id = '00000000-0000-0000-0000-0000000000e1' $$,
  '%not client-writable%',
  'trigger still blocks authenticated writes to guarded columns even if UPDATE grant + RLS policy are (re-)opened'
);

reset role;
drop policy venues_update_reopened_for_test on public.venues;
revoke update on table public.venues from authenticated;

-- ---------------------------------------------------------------------
-- 5. service_role (what api/places-refresh.ts authenticates as via the
--    Supabase service-role key) can still write the guarded columns --
--    the trigger must not be a blanket lockout.
-- ---------------------------------------------------------------------

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

update public.venues
set name = 'Refreshed Venue Name', latitude = 40.7129, longitude = -74.0061
where id = '00000000-0000-0000-0000-0000000000e1';

select results_eq(
  $$ select name from public.venues where id = '00000000-0000-0000-0000-0000000000e1' $$,
  ARRAY['Refreshed Venue Name'::text],
  'service_role can write guarded columns (server-only write path stays open)'
);

reset role;

-- ---------------------------------------------------------------------
-- 6. Unguarded columns (e.g. country) are unaffected by the trigger,
--    confirming it is scoped to the 5 guarded columns (BEFORE UPDATE OF
--    name, latitude, longitude, place_provider, provider_place_id) rather
--    than accidentally locking the whole table server-side.
-- ---------------------------------------------------------------------

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select lives_ok(
  $$ update public.venues set country = 'Updated Country' where id = '00000000-0000-0000-0000-0000000000e1' $$,
  'service_role can update non-guarded columns without tripping the trigger'
);

reset role;

select * from finish();

rollback;

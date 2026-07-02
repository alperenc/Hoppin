-- Regression coverage for the places_refresh_calls rate-limit table
-- (supabase/migrations/0008_places_refresh_rate_limit.sql), tracked by
-- GitHub issue #44's 4th assertion ("the rate limiter actually rejects
-- after the configured threshold").
--
-- The sliding-window threshold decision itself (RATE_LIMIT_MAX_CALLS /
-- RATE_LIMIT_WINDOW_MS in api/places-refresh.ts) is plain TypeScript over a
-- count() query result and isn't meaningfully testable at the SQL layer in
-- isolation -- what *is* testable here, and what the threshold check's
-- integrity depends on, is that no client role can read or write this table
-- directly (only the service-role Vercel function can), so a malicious
-- client can't clear its own rate-limit history or spoof another user's
-- call count. See also src/lib/placesRefreshPolicy.test.ts for the pure
-- unit-testable proximity/link-eligibility logic from the same endpoint.
--
-- NOTE on the grant below: see the matching note in
-- supabase/tests/venues_column_scope_guard.test.sql -- this repo's
-- migrations have only run against the hosted Supabase dashboard
-- (supabase_admin), whose default ACL for new public tables differs from
-- the Supabase CLI's local/test stack (plain postgres). Without this grant,
-- service_role has no SELECT/INSERT on places_refresh_calls in a bare local
-- run, for an environment-identity reason unrelated to the RLS-default-deny
-- behavior this file actually tests.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

grant select, insert on public.places_refresh_calls to service_role;

-- ---------------------------------------------------------------------
-- 1. RLS is enabled and no policy exists, so it denies all client access
--    by default (per migration 0008's own comment).
-- ---------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.places_refresh_calls'::regclass),
  'row level security is enabled on public.places_refresh_calls'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'places_refresh_calls'),
  0,
  'no RLS policy is defined on public.places_refresh_calls (default-deny for all client roles)'
);

-- ---------------------------------------------------------------------
-- 2. Neither authenticated nor anon can read or write the table directly
--    -- a client must never be able to inspect or clear its own call
--    history to dodge the rate limit. No SELECT/INSERT grant was ever
--    given to these roles (only Supabase's default D/x/t/m privileges),
--    so this is blocked at the grant level, same as the venues guard.
-- ---------------------------------------------------------------------

select is(
  has_table_privilege('authenticated', 'public.places_refresh_calls', 'SELECT'),
  false,
  'authenticated has no SELECT grant on places_refresh_calls'
);

select is(
  has_table_privilege('authenticated', 'public.places_refresh_calls', 'INSERT'),
  false,
  'authenticated has no INSERT grant on places_refresh_calls'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}';

select throws_ok(
  $$ select count(*) from public.places_refresh_calls $$,
  '42501',
  null,
  'authenticated cannot read places_refresh_calls directly (no grant, RLS never even evaluated)'
);

select throws_ok(
  $$ insert into public.places_refresh_calls (profile_id) values ('00000000-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'authenticated cannot insert into places_refresh_calls directly (no grant, RLS never even evaluated)'
);

reset role;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select count(*) from public.places_refresh_calls $$,
  '42501',
  null,
  'anon cannot read places_refresh_calls directly (no grant, RLS never even evaluated)'
);

reset role;

-- ---------------------------------------------------------------------
-- 3. service_role (the role api/places-refresh.ts authenticates as) can
--    both insert call records and count them -- confirming the sliding
--    window query the endpoint runs before every request actually works.
-- ---------------------------------------------------------------------

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

insert into public.places_refresh_calls (profile_id) values ('00000000-0000-0000-0000-000000000001');

select is(
  (select count(*)::int from public.places_refresh_calls where profile_id = '00000000-0000-0000-0000-000000000001'),
  1,
  'service_role can insert and count places_refresh_calls rows for the sliding-window check'
);

reset role;

select * from finish();

rollback;

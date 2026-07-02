-- Regression coverage for the rate_limit_counters table and rate_limit_hit()
-- RPC (supabase/migrations/0009_rate_limit_rpc.sql), tracked by GitHub
-- issue #44's 4th assertion ("the rate limiter actually rejects after the
-- configured threshold").
--
-- What's testable here, and what the limiter's integrity depends on: no
-- client role can read/write rate_limit_counters directly, and no client
-- role can call rate_limit_hit() directly -- only the service-role Vercel
-- function (api/places-refresh.ts, api/places.ts) can, since a client that
-- could call the RPC directly could spoof any bucket/key pair and either
-- clear its own history or exhaust someone else's limit. The atomic
-- increment-and-check behavior of rate_limit_hit() itself (single
-- statement, no separate check-then-insert) is exercised as service_role
-- below, including that it actually rejects once the configured max is hit.
--
-- NOTE on the grant below: see the matching note in
-- supabase/tests/venues_column_scope_guard.test.sql -- this repo's
-- migrations have only run against the hosted Supabase dashboard
-- (supabase_admin), whose default ACL for new public tables differs from
-- the Supabase CLI's local/test stack (plain postgres). Without this grant,
-- service_role has no SELECT/INSERT on rate_limit_counters in a bare local
-- run, for an environment-identity reason unrelated to the RLS-default-deny
-- behavior this file actually tests.

begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

grant select, insert on public.rate_limit_counters to service_role;

-- ---------------------------------------------------------------------
-- 1. RLS is enabled and no policy exists, so it denies all client access
--    by default (per migration 0009's own comment).
-- ---------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.rate_limit_counters'::regclass),
  'row level security is enabled on public.rate_limit_counters'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'rate_limit_counters'),
  0,
  'no RLS policy is defined on public.rate_limit_counters (default-deny for all client roles)'
);

-- ---------------------------------------------------------------------
-- 2. Neither authenticated nor anon can read or write the table directly,
--    or call rate_limit_hit() -- a client must never be able to inspect
--    or clear its own call history, or spoof another caller's bucket/key,
--    to dodge the rate limit.
-- ---------------------------------------------------------------------

select is(
  has_table_privilege('authenticated', 'public.rate_limit_counters', 'SELECT'),
  false,
  'authenticated has no SELECT grant on rate_limit_counters'
);

select is(
  has_table_privilege('anon', 'public.rate_limit_counters', 'SELECT'),
  false,
  'anon has no SELECT grant on rate_limit_counters'
);

select is(
  has_function_privilege('authenticated', 'public.rate_limit_hit(text, text, integer, integer)', 'EXECUTE'),
  false,
  'authenticated has no EXECUTE grant on rate_limit_hit()'
);

select is(
  has_function_privilege('anon', 'public.rate_limit_hit(text, text, integer, integer)', 'EXECUTE'),
  false,
  'anon has no EXECUTE grant on rate_limit_hit()'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}';

select throws_ok(
  $$ select count(*) from public.rate_limit_counters $$,
  '42501',
  null,
  'authenticated cannot read rate_limit_counters directly (no grant, RLS never even evaluated)'
);

select throws_ok(
  $$ select public.rate_limit_hit('places-refresh:user', '00000000-0000-0000-0000-000000000001', 600, 20) $$,
  '42501',
  null,
  'authenticated cannot call rate_limit_hit() directly (no EXECUTE grant)'
);

reset role;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select count(*) from public.rate_limit_counters $$,
  '42501',
  null,
  'anon cannot read rate_limit_counters directly (no grant, RLS never even evaluated)'
);

select throws_ok(
  $$ select public.rate_limit_hit('places-refresh:user', '00000000-0000-0000-0000-000000000002', 600, 20) $$,
  '42501',
  null,
  'anon cannot call rate_limit_hit() directly (no EXECUTE grant)'
);

reset role;

-- ---------------------------------------------------------------------
-- 3. service_role (the role api/places-refresh.ts and api/places.ts
--    authenticate as) can call rate_limit_hit(), and it atomically counts
--    each call and rejects once the configured max is exceeded for the
--    current window -- confirming the threshold check the endpoints rely
--    on actually enforces a limit rather than always allowing.
-- ---------------------------------------------------------------------

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select ok(
  (select public.rate_limit_hit('test:bucket', 'caller-a', 600, 2)),
  'first call within a fresh window is allowed'
);

select ok(
  (select public.rate_limit_hit('test:bucket', 'caller-a', 600, 2)),
  'second call is still within the limit and is allowed'
);

select ok(
  not (select public.rate_limit_hit('test:bucket', 'caller-a', 600, 2)),
  'third call in the same window exceeds max_calls=2 and is rejected'
);

reset role;

select * from finish();

rollback;

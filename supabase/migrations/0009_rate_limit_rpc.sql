-- Replaces the places_refresh_calls table-based limiter (0008) with a
-- purpose-built atomic counter, and extends coverage to api/places.ts,
-- which has never had any rate limiting (see issue #45).
--
-- Why not an external limiter (Vercel WAF rate_limit rules, Upstash
-- Ratelimit via the Marketplace, an edge KV): both require provisioning
-- infrastructure outside this repo -- WAF rules are staged/published
-- through the Vercel dashboard/CLI by a human, and Upstash is a new
-- Marketplace integration that adds a new billing surface even on its
-- free tier. Neither can be stood up from a migration + code change alone.
-- This RPC-based approach fixes the three concrete problems raised in #45
-- (unbounded growth, check-then-insert race, write contention) without
-- introducing new infrastructure, and can be swapped for Upstash/WAF later
-- as a fast-follow once traffic actually justifies new infra spend.
--
-- Design:
-- - One row per (bucket, key, window_start) instead of one row per call.
--   window_start is the call timestamp truncated to a fixed-size bucket
--   (floor(epoch / window_seconds) * window_seconds), so all calls from the
--   same caller inside the same window collapse onto a single row via
--   `on conflict do update ... increment`. This is a single atomic
--   statement -- no separate check-then-insert, so no race between
--   concurrent requests from the same caller.
-- - Old windows are pruned opportunistically in the same statement that
--   records a new hit (delete rows for that bucket older than 2 windows),
--   so the table self-cleans without a cron job (this repo's vercel.json
--   has no crons config).
-- - `bucket` namespaces callers (e.g. 'places-refresh:user',
--   'places-refresh:ip', 'places:user', 'places:ip'), so the same key
--   (a user id or an IP) can be tracked independently per endpoint/scope.

create table if not exists public.rate_limit_counters (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  call_count integer not null default 0,
  primary key (bucket, key, window_start)
);

-- Supports the cleanup delete (all rows for a bucket/key older than N) and
-- the conflict target above already covers point lookups.
create index if not exists rate_limit_counters_bucket_window_idx
  on public.rate_limit_counters (bucket, window_start);

-- Service-role only: no client ever reads or writes this table directly,
-- and no policy is defined, so RLS denies all client access by default.
alter table public.rate_limit_counters enable row level security;

-- Atomically records one call against (bucket, key) and reports whether it
-- is within the configured limit for the current fixed window. Returns
-- true if the call is allowed (and has been counted), false if the caller
-- is over the limit for the current window (still counted, so retries
-- don't get a free pass).
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_key text,
  p_window_seconds integer,
  p_max_calls integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limit_counters as rlc (bucket, key, window_start, call_count)
  values (p_bucket, p_key, v_window_start, 1)
  on conflict (bucket, key, window_start)
    do update set call_count = rlc.call_count + 1
  returning call_count into v_count;

  -- Opportunistic cleanup: drop this bucket/key's rows from windows more
  -- than 2 windows old. Runs on every hit, so rows never accumulate beyond
  -- a couple of windows per (bucket, key) pair -- no separate cron needed.
  delete from public.rate_limit_counters
  where bucket = p_bucket
    and key = p_key
    and window_start < v_window_start - (p_window_seconds * 2 || ' seconds')::interval;

  return v_count <= p_max_calls;
end;
$$;

revoke all on function public.rate_limit_hit(text, text, integer, integer) from public;
grant execute on function public.rate_limit_hit(text, text, integer, integer) to service_role;

-- The old per-call-row table and its index are superseded by
-- rate_limit_counters above.
drop table if exists public.places_refresh_calls;

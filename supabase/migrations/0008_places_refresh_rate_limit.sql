-- api/places-refresh.ts has no rate limit: any authenticated client can call
-- it as fast as it likes, each call spending a Google Places API request and
-- a service-role DB round-trip. Track recent calls per user so the endpoint
-- can reject bursts before doing any of that work.

create table if not exists public.places_refresh_calls (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists places_refresh_calls_profile_created_idx
  on public.places_refresh_calls (profile_id, created_at desc);

-- Service-role only: no client ever reads or writes this table directly, and
-- no policy is defined, so RLS denies all client access by default.
alter table public.places_refresh_calls enable row level security;

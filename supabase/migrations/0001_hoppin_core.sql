-- Hoppin passport MVP schema
create extension if not exists "pgcrypto";
create extension if not exists postgis;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  avatar_url text,
  is_creator boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_follower_idx on public.follows(follower_id);
create index if not exists follows_following_idx on public.follows(following_id);

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  country text not null,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  created_at timestamptz not null default now()
);

create unique index if not exists cities_city_country_idx on public.cities (lower(city), lower(country));

create table if not exists public.breweries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  website text,
  created_at timestamptz not null default now()
);

create unique index if not exists breweries_lower_name_idx on public.breweries (lower(name));

create table if not exists public.beers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  style text not null check (style in ('ipa', 'pilsner', 'lager', 'porter', 'stout', 'wheat', 'amber', 'sour', 'experimental', 'other')),
  abv numeric(4,2),
  ibu int,
  brewery_id uuid references public.breweries(id),
  barcode text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists beers_lower_name_style_idx on public.beers (lower(name), style);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city_id uuid references public.cities(id),
  country text,
  place_provider text not null default 'google',
  provider_place_id text,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  created_at timestamptz not null default now()
);

create index if not exists venues_city_idx on public.venues(city_id);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  city_id uuid references public.cities(id),
  title text,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  beer_id uuid not null references public.beers(id) on delete restrict,
  scope text not null check (scope in ('venue', 'city')),
  venue_id uuid references public.venues(id),
  city_id uuid references public.cities(id),
  checked_at timestamptz not null default now(),
  privacy text not null default 'followers' check (privacy in ('private', 'followers', 'public')),
  rating int check (rating is null or rating between 1 and 5),
  note text,
  photo_urls text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkin_scope_ref check (
    (scope = 'venue' and venue_id is not null and city_id is null) or
    (scope = 'city' and city_id is not null and venue_id is null)
  )
);

create index if not exists checkins_profile_scope_idx on public.checkins(profile_id, checked_at desc);
create index if not exists checkins_privacy_idx on public.checkins(privacy);
create index if not exists checkins_venue_idx on public.checkins(venue_id);
create index if not exists checkins_city_idx on public.checkins(city_id);

create or replace view public.passport_summary
with (security_invoker = true) as
  select
    c.profile_id,
    count(*) as checkins_count,
    count(distinct coalesce(ci.id, vc.id)) as cities_count,
    count(distinct coalesce(ci.country, vc.country)) as countries_count,
    count(distinct c.beer_id) as unique_beers_count,
    count(distinct b.brewery_id) as unique_breweries_count
  from public.checkins c
  left join public.cities ci on c.city_id = ci.id
  left join public.venues v on c.venue_id = v.id
  left join public.cities vc on v.city_id = vc.id
  left join public.beers b on c.beer_id = b.id
  group by c.profile_id;

create or replace view public.city_stamps
with (security_invoker = true) as
  select
    c.profile_id,
    coalesce(ci.city, vc.city) as city,
    coalesce(ci.country, vc.country) as country,
    coalesce(ci.latitude::double precision, vc.latitude::double precision) as latitude,
    coalesce(ci.longitude::double precision, vc.longitude::double precision) as longitude,
    count(*)::int as checkin_count,
    max(c.checked_at) as last_visited_at
  from public.checkins c
  left join public.cities ci on c.city_id = ci.id
  left join public.venues v on c.venue_id = v.id
  left join public.cities vc on v.city_id = vc.id
  where coalesce(ci.city, vc.city) is not null
  group by
    c.profile_id,
    coalesce(ci.city, vc.city),
    coalesce(ci.country, vc.country),
    coalesce(ci.latitude::double precision, vc.latitude::double precision),
    coalesce(ci.longitude::double precision, vc.longitude::double precision)
  ;

create or replace function public.get_passport_top_styles(p_profile_id uuid)
returns table (style text, count bigint)
language sql
stable
as $$
  select
    b.style,
    count(*)::bigint as count
  from public.checkins c
  join public.beers b on b.id = c.beer_id
  where c.profile_id = p_profile_id
  group by b.style
  order by count(*) desc
  limit 5;
$$;

drop type if exists public.follow_feed_item;
create type public.follow_feed_item as (
  checkin_id uuid,
  profile_id uuid,
  scope text,
  privacy text,
  checked_at timestamptz,
  rating int,
  note text,
  photo_urls text[],
  beer_id uuid,
  beer_name text,
  beer_style text,
  beer_abv numeric(4,2),
  beer_ibu int,
  beer_brewery jsonb,
  city text,
  country text,
  latitude double precision,
  longitude double precision,
  venue_id uuid,
  venue_name text,
  author_profile jsonb,
  is_followed boolean
);

create or replace function public.get_follower_feed(p_viewer_id uuid default auth.uid())
returns setof public.follow_feed_item
language sql
stable
as $$
  select
    c.id,
    c.profile_id,
    c.scope,
    c.privacy,
    c.checked_at,
    c.rating,
    c.note,
    c.photo_urls,
    b.id,
    b.name,
    b.style,
    b.abv,
    b.ibu,
    jsonb_build_object('id', br.id, 'name', br.name),
    coalesce(ci.city, vc.city),
    coalesce(ci.country, vc.country),
    coalesce(ci.latitude::double precision, vc.latitude::double precision),
    coalesce(ci.longitude::double precision, vc.longitude::double precision),
    c.venue_id,
    v.name,
    jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'displayName', p.display_name,
      'avatarUrl', p.avatar_url,
      'isCreator', p.is_creator,
      'createdAt', p.created_at
    ),
    exists (
      select 1
      from public.follows f
      where f.follower_id = p_viewer_id and f.following_id = c.profile_id
    )
  from public.checkins c
  join public.profiles p on p.id = c.profile_id
  join public.beers b on b.id = c.beer_id
  left join public.breweries br on br.id = b.brewery_id
  left join public.cities ci on c.city_id = ci.id
  left join public.venues v on c.venue_id = v.id
  left join public.cities vc on vc.id = v.city_id
  where
    c.privacy = 'public'
    or (p_viewer_id is not null and c.profile_id = p_viewer_id)
    or (
      p_viewer_id is not null
      and c.privacy = 'followers'
      and exists (
        select 1
        from public.follows f
        where f.follower_id = p_viewer_id and f.following_id = c.profile_id
      )
    )
  order by c.checked_at desc;
$$;

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.cities enable row level security;
alter table public.breweries enable row level security;
alter table public.beers enable row level security;
alter table public.venues enable row level security;
alter table public.trips enable row level security;
alter table public.checkins enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (auth.uid() = id);

drop policy if exists follows_select_all on public.follows;
create policy follows_select_all on public.follows for select using (true);

drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self on public.follows for insert with check (auth.uid() = follower_id);

drop policy if exists follows_delete_self on public.follows;
create policy follows_delete_self on public.follows for delete using (auth.uid() = follower_id);

drop policy if exists follows_update_admin on public.follows;
create policy follows_update_admin on public.follows for update using (auth.uid() = follower_id);

drop policy if exists cities_select_all on public.cities;
create policy cities_select_all on public.cities for select using (true);

drop policy if exists cities_insert_authenticated on public.cities;
create policy cities_insert_authenticated on public.cities for insert with check (auth.role() = 'authenticated');

drop policy if exists cities_update_authenticated on public.cities;
create policy cities_update_authenticated on public.cities for update using (auth.role() = 'authenticated');

drop policy if exists breweries_select_all on public.breweries;
create policy breweries_select_all on public.breweries for select using (true);

drop policy if exists breweries_insert_authenticated on public.breweries;
create policy breweries_insert_authenticated on public.breweries for insert with check (auth.role() = 'authenticated');

drop policy if exists beers_select_all on public.beers;
create policy beers_select_all on public.beers for select using (true);

drop policy if exists beers_insert_authenticated on public.beers;
create policy beers_insert_authenticated on public.beers for insert with check (auth.role() = 'authenticated');

drop policy if exists venues_select_all on public.venues;
create policy venues_select_all on public.venues for select using (true);

drop policy if exists venues_insert_authenticated on public.venues;
create policy venues_insert_authenticated on public.venues for insert with check (auth.role() = 'authenticated');

drop policy if exists trips_select_all on public.trips;
create policy trips_select_all on public.trips for select using (auth.uid() = profile_id);

drop policy if exists trips_write_owner on public.trips;
create policy trips_write_owner on public.trips for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists checkins_select_feed on public.checkins;
create policy checkins_select_feed on public.checkins for select using (
  profile_id = auth.uid()
  or privacy = 'public'
  or (
    privacy = 'followers'
    and exists (
      select 1
      from public.follows f
      where f.follower_id = auth.uid() and f.following_id = profile_id
    )
  )
);

drop policy if exists checkins_insert_owner on public.checkins;
create policy checkins_insert_owner on public.checkins for insert with check (auth.uid() = profile_id);

drop policy if exists checkins_update_owner on public.checkins;
create policy checkins_update_owner on public.checkins for update using (auth.uid() = profile_id);

drop policy if exists checkins_delete_owner on public.checkins;
create policy checkins_delete_owner on public.checkins for delete using (auth.uid() = profile_id);

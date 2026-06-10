-- Harden auth-owned writes and feed/passport query support.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_username_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_format
      check (username = lower(username) and username ~ '^[a-z0-9_]{3,36}$')
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_display_name_not_blank'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_display_name_not_blank
      check (btrim(display_name) <> '')
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cities_name_not_blank'
      and conrelid = 'public.cities'::regclass
  ) then
    alter table public.cities
      add constraint cities_name_not_blank
      check (btrim(city) <> '' and btrim(country) <> '')
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cities_coordinate_bounds'
      and conrelid = 'public.cities'::regclass
  ) then
    alter table public.cities
      add constraint cities_coordinate_bounds
      check (latitude between -90 and 90 and longitude between -180 and 180)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'breweries_name_not_blank'
      and conrelid = 'public.breweries'::regclass
  ) then
    alter table public.breweries
      add constraint breweries_name_not_blank
      check (btrim(name) <> '')
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'beers_name_not_blank'
      and conrelid = 'public.beers'::regclass
  ) then
    alter table public.beers
      add constraint beers_name_not_blank
      check (btrim(name) <> '')
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'beers_measurement_bounds'
      and conrelid = 'public.beers'::regclass
  ) then
    alter table public.beers
      add constraint beers_measurement_bounds
      check (
        (abv is null or abv between 0 and 30)
        and (ibu is null or ibu between 0 and 200)
      )
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'venues_name_not_blank'
      and conrelid = 'public.venues'::regclass
  ) then
    alter table public.venues
      add constraint venues_name_not_blank
      check (btrim(name) <> '')
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'venues_coordinate_bounds'
      and conrelid = 'public.venues'::regclass
  ) then
    alter table public.venues
      add constraint venues_coordinate_bounds
      check (latitude between -90 and 90 and longitude between -180 and 180)
      not valid;
  end if;
end $$;

create unique index if not exists venues_city_lower_name_idx
  on public.venues (city_id, lower(name))
  where city_id is not null;

create unique index if not exists venues_provider_place_id_idx
  on public.venues (place_provider, provider_place_id)
  where provider_place_id is not null;

create index if not exists checkins_feed_public_checked_idx
  on public.checkins (checked_at desc)
  where privacy = 'public';

create index if not exists checkins_profile_privacy_checked_idx
  on public.checkins (profile_id, privacy, checked_at desc);

create index if not exists checkins_beer_idx on public.checkins(beer_id);
create index if not exists trips_profile_started_idx on public.trips(profile_id, started_at desc);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists follows_select_all on public.follows;
create policy follows_select_all on public.follows for select using (true);

drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self on public.follows
  for insert
  with check (auth.uid() = follower_id and follower_id <> following_id);

drop policy if exists follows_delete_self on public.follows;
create policy follows_delete_self on public.follows
  for delete
  using (auth.uid() = follower_id);

drop policy if exists follows_update_admin on public.follows;
drop policy if exists follows_update_self on public.follows;

drop policy if exists cities_select_all on public.cities;
create policy cities_select_all on public.cities for select using (true);

drop policy if exists cities_insert_authenticated on public.cities;
create policy cities_insert_authenticated on public.cities
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists cities_update_authenticated on public.cities;

drop policy if exists breweries_select_all on public.breweries;
create policy breweries_select_all on public.breweries for select using (true);

drop policy if exists breweries_insert_authenticated on public.breweries;
create policy breweries_insert_authenticated on public.breweries
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists beers_select_all on public.beers;
create policy beers_select_all on public.beers for select using (true);

drop policy if exists beers_insert_authenticated on public.beers;
create policy beers_insert_authenticated on public.beers
  for insert
  with check (auth.role() = 'authenticated' and (created_by is null or created_by = auth.uid()));

drop policy if exists venues_select_all on public.venues;
create policy venues_select_all on public.venues for select using (true);

drop policy if exists venues_insert_authenticated on public.venues;
create policy venues_insert_authenticated on public.venues
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists trips_select_all on public.trips;
drop policy if exists trips_select_owner on public.trips;
create policy trips_select_owner on public.trips
  for select
  using (auth.uid() = profile_id);

drop policy if exists trips_write_owner on public.trips;
drop policy if exists trips_insert_owner on public.trips;
create policy trips_insert_owner on public.trips
  for insert
  with check (auth.uid() = profile_id);

drop policy if exists trips_update_owner on public.trips;
create policy trips_update_owner on public.trips
  for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists trips_delete_owner on public.trips;
create policy trips_delete_owner on public.trips
  for delete
  using (auth.uid() = profile_id);

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
create policy checkins_insert_owner on public.checkins
  for insert
  with check (auth.uid() = profile_id);

drop policy if exists checkins_update_owner on public.checkins;
create policy checkins_update_owner on public.checkins
  for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists checkins_delete_owner on public.checkins;
create policy checkins_delete_owner on public.checkins
  for delete
  using (auth.uid() = profile_id);

create or replace function public.get_follower_feed(p_viewer_id uuid default auth.uid())
returns setof public.follow_feed_item
language sql
stable
as $$
  with viewer as (
    select
      case
        when p_viewer_id is null then auth.uid()
        when p_viewer_id = auth.uid() then p_viewer_id
        else null::uuid
      end as id
  )
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
      where f.follower_id = viewer.id and f.following_id = c.profile_id
    )
  from viewer
  join public.checkins c on true
  join public.profiles p on p.id = c.profile_id
  join public.beers b on b.id = c.beer_id
  left join public.breweries br on br.id = b.brewery_id
  left join public.cities ci on c.city_id = ci.id
  left join public.venues v on c.venue_id = v.id
  left join public.cities vc on vc.id = v.city_id
  where
    viewer.id is not null
    and (
      c.privacy = 'public'
      or c.profile_id = viewer.id
      or (
        c.privacy = 'followers'
        and exists (
          select 1
          from public.follows f
          where f.follower_id = viewer.id and f.following_id = c.profile_id
        )
      )
    )
  order by c.checked_at desc;
$$;

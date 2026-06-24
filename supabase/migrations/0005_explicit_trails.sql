create table if not exists public.trails (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text,
  privacy text not null default 'private' check (privacy in ('private', 'followers', 'public')),
  cover_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trail_items (
  id uuid primary key default gen_random_uuid(),
  trail_id uuid not null references public.trails(id) on delete cascade,
  position integer not null default 0,
  item_type text not null check (item_type in ('checkin', 'place')),
  checkin_id uuid references public.checkins(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  city_id uuid references public.cities(id) on delete set null,
  title text,
  note text,
  checkin_beer_name text,
  checkin_beer_style text,
  checkin_location_name text,
  checkin_city text,
  checkin_country text,
  checkin_checked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint trail_items_payload_check check (
    (item_type = 'checkin' and checkin_id is not null)
    or
    (item_type = 'place' and checkin_id is null and (venue_id is not null or city_id is not null or nullif(trim(coalesce(title, '')), '') is not null))
  )
);

create index if not exists trails_profile_id_idx on public.trails(profile_id);
create index if not exists trails_privacy_updated_at_idx on public.trails(privacy, updated_at desc);
create index if not exists trail_items_trail_id_position_idx on public.trail_items(trail_id, position);
create index if not exists trail_items_checkin_id_idx on public.trail_items(checkin_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_trails_updated_at on public.trails;
create trigger set_trails_updated_at
  before update on public.trails
  for each row execute function public.set_updated_at();

alter table public.trails enable row level security;
alter table public.trail_items enable row level security;

drop policy if exists "Trails are visible by privacy" on public.trails;
create policy "Trails are visible by privacy" on public.trails
  for select using (
    profile_id = auth.uid()
    or privacy = 'public'
    or (
      privacy = 'followers'
      and exists (
        select 1
        from public.follows
        where follows.follower_id = auth.uid()
          and follows.following_id = trails.profile_id
      )
    )
  );

drop policy if exists "Trail owners can create trails" on public.trails;
create policy "Trail owners can create trails" on public.trails
  for insert with check (profile_id = auth.uid());

drop policy if exists "Trail owners can update trails" on public.trails;
create policy "Trail owners can update trails" on public.trails
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "Trail owners can delete trails" on public.trails;
create policy "Trail owners can delete trails" on public.trails
  for delete using (profile_id = auth.uid());

drop policy if exists "Trail items are visible with trails" on public.trail_items;
create policy "Trail items are visible with trails" on public.trail_items
  for select using (
    exists (
      select 1
      from public.trails
      where trails.id = trail_items.trail_id
        and (
          trails.profile_id = auth.uid()
          or trails.privacy = 'public'
          or (
            trails.privacy = 'followers'
            and exists (
              select 1
              from public.follows
              where follows.follower_id = auth.uid()
                and follows.following_id = trails.profile_id
            )
          )
        )
    )
  );

drop policy if exists "Trail owners can create trail items" on public.trail_items;
create policy "Trail owners can create trail items" on public.trail_items
  for insert with check (
    exists (
      select 1
      from public.trails
      where trails.id = trail_items.trail_id
        and trails.profile_id = auth.uid()
    )
    and (
      trail_items.item_type <> 'checkin'
      or exists (
        select 1
        from public.checkins
        where checkins.id = trail_items.checkin_id
          and checkins.profile_id = auth.uid()
      )
    )
  );

drop policy if exists "Trail owners can update trail items" on public.trail_items;
create policy "Trail owners can update trail items" on public.trail_items
  for update using (
    exists (
      select 1
      from public.trails
      where trails.id = trail_items.trail_id
        and trails.profile_id = auth.uid()
    )
    and (
      trail_items.item_type <> 'checkin'
      or exists (
        select 1
        from public.checkins
        where checkins.id = trail_items.checkin_id
          and checkins.profile_id = auth.uid()
      )
    )
  ) with check (
    exists (
      select 1
      from public.trails
      where trails.id = trail_items.trail_id
        and trails.profile_id = auth.uid()
    )
    and (
      trail_items.item_type <> 'checkin'
      or exists (
        select 1
        from public.checkins
        where checkins.id = trail_items.checkin_id
          and checkins.profile_id = auth.uid()
      )
    )
  );

drop policy if exists "Trail owners can delete trail items" on public.trail_items;
create policy "Trail owners can delete trail items" on public.trail_items
  for delete using (
    exists (
      select 1
      from public.trails
      where trails.id = trail_items.trail_id
        and trails.profile_id = auth.uid()
    )
  );

create or replace function public.reorder_trail_items(p_trail_id uuid, p_item_ids uuid[])
returns void
language plpgsql
as $$
declare
  expected_count integer;
begin
  if not exists (
    select 1
    from public.trails
    where id = p_trail_id
      and profile_id = auth.uid()
  ) then
    raise exception 'Trail not found or not owned by current user.';
  end if;

  select count(*) into expected_count
  from public.trail_items
  where trail_id = p_trail_id;

  if expected_count <> coalesce(array_length(p_item_ids, 1), 0) then
    raise exception 'Trail item order must include every trail item.';
  end if;

  if exists (
    select 1
    from unnest(p_item_ids) as ordered(item_id)
    group by ordered.item_id
    having count(*) > 1
  ) then
    raise exception 'Trail item order cannot contain duplicate items.';
  end if;

  if exists (
    select 1
    from unnest(p_item_ids) with ordinality as ordered(item_id, item_position)
    left join public.trail_items ti on ti.id = ordered.item_id and ti.trail_id = p_trail_id
    where ti.id is null
  ) then
    raise exception 'Trail item order contains an item outside this trail.';
  end if;

  update public.trail_items ti
  set position = ordered.item_position - 1
  from unnest(p_item_ids) with ordinality as ordered(item_id, item_position)
  where ti.id = ordered.item_id
    and ti.trail_id = p_trail_id;

  update public.trails
  set updated_at = now()
  where id = p_trail_id;
end;
$$;

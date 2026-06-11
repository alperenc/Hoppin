-- Beer barcode dedupe support

update public.beers
set barcode = substring(barcode from 2)
where barcode ~ '^0[0-9]{12}$';

with duplicate_barcodes as (
  select
    id,
    row_number() over (partition by barcode order by created_at, id) as duplicate_rank
  from public.beers
  where barcode is not null
)
update public.beers b
set barcode = null
from duplicate_barcodes d
where b.id = d.id
  and d.duplicate_rank > 1;

create unique index if not exists beers_barcode_unique_idx
  on public.beers (barcode)
  where barcode is not null;

revoke update on table public.beers from authenticated;
grant update (barcode) on table public.beers to authenticated;

drop policy if exists beers_attach_barcode_owner on public.beers;
create policy beers_attach_barcode_owner on public.beers
  for update
  using (auth.uid() = created_by and barcode is null)
  with check (auth.uid() = created_by and barcode is not null);

drop function if exists public.attach_beer_barcode(uuid, text);

create table if not exists public.beer_barcode_claims (
  id uuid primary key default gen_random_uuid(),
  beer_id uuid not null references public.beers(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  barcode text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists beer_barcode_claims_profile_barcode_idx
  on public.beer_barcode_claims (profile_id, barcode);

create index if not exists beer_barcode_claims_beer_idx
  on public.beer_barcode_claims (beer_id);

alter table public.beer_barcode_claims enable row level security;

drop policy if exists beer_barcode_claims_select_self on public.beer_barcode_claims;
create policy beer_barcode_claims_select_self on public.beer_barcode_claims
  for select
  using (auth.uid() = profile_id);

drop policy if exists beer_barcode_claims_insert_self on public.beer_barcode_claims;
create policy beer_barcode_claims_insert_self on public.beer_barcode_claims
  for insert
  with check (auth.uid() = profile_id);

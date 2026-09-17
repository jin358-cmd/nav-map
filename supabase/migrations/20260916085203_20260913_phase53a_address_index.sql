-- Phase 5.3A address-index extras. Additive only.

alter table if exists public.taiwan_address_index
  add column if not exists sub_number text,
  add column if not exists attached_number text,
  add column if not exists locality text,
  add column if not exists canonical_address_key text,
  add column if not exists source_priority integer not null default 50,
  add column if not exists quality_score integer,
  add column if not exists region_validation text,
  add column if not exists data_version text,
  add column if not exists publish_status text not null default 'staging';

create index if not exists taiwan_address_index_door_idx
  on public.taiwan_address_index (county, district, road, section, house_number, sub_number);

create index if not exists taiwan_address_index_village_idx
  on public.taiwan_address_index (county, district, village, neighborhood, house_number);

create table if not exists public.taiwan_address_aliases (
  id bigserial primary key,
  kind text not null,
  from_text text not null,
  to_text text not null,
  county text,
  unique (kind, from_text, to_text)
);

insert into public.taiwan_address_aliases (kind, from_text, to_text)
values
  ('county', '台南市', '臺南市'),
  ('county', '台中市', '臺中市'),
  ('county', '台北市', '臺北市'),
  ('county', '台東縣', '臺東縣')
on conflict do nothing;

alter table public.taiwan_address_index enable row level security;
alter table public.taiwan_address_aliases enable row level security;

drop policy if exists taiwan_address_index_public_read on public.taiwan_address_index;
create policy taiwan_address_index_public_read
on public.taiwan_address_index
for select
to anon, authenticated
using (
  publish_status = 'published'
  and county in ('雲林縣', '嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣')
);

create or replace function public.search_taiwan_addresses(
  q text,
  max_results integer default 12
)
returns table (
  id text,
  display_address text,
  normalized_address text,
  latitude double precision,
  longitude double precision,
  accuracy text,
  source text,
  county text,
  district text,
  road text,
  house_number text,
  sub_number text
)
language sql
stable
as $$
  select
    poi.id,
    poi.display_address,
    poi.normalized_address,
    poi.latitude,
    poi.longitude,
    poi.accuracy,
    poi.source,
    poi.county,
    poi.district,
    poi.road,
    poi.house_number,
    poi.sub_number
  from public.taiwan_address_index poi
  where
    poi.publish_status = 'published'
    and poi.county in ('雲林縣', '嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣')
    and (
      poi.normalized_address ilike '%' || q || '%'
      or poi.canonical_address_key ilike '%' || replace(lower(q), '台', '臺') || '%'
    )
  order by poi.quality_score desc nulls last, poi.normalized_address
  limit greatest(1, least(coalesce(max_results, 12), 24));
$$;

revoke all on function public.search_taiwan_addresses(text, integer) from public;
grant execute on function public.search_taiwan_addresses(text, integer) to anon, authenticated;

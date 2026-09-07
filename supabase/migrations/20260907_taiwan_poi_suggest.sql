create extension if not exists pg_trgm;
create extension if not exists postgis;

alter table public.taiwan_poi_index
  add column if not exists branch_name text,
  add column if not exists address_normalized text not null default '',
  add column if not exists city text,
  add column if not exists confidence double precision not null default 0.8,
  add column if not exists is_active boolean not null default true;

update public.taiwan_poi_index
set city = coalesce(city, county)
where city is null;

update public.taiwan_poi_index
set address_normalized = lower(replace(replace(address, '臺', '台'), ' ', ''))
where address_normalized = '';

create index if not exists taiwan_poi_index_name_prefix_idx
  on public.taiwan_poi_index (name_normalized text_pattern_ops)
  where is_active;

create index if not exists taiwan_poi_index_brand_idx
  on public.taiwan_poi_index (brand)
  where is_active;

create index if not exists taiwan_poi_index_category_active_idx
  on public.taiwan_poi_index (category)
  where is_active;

create index if not exists taiwan_poi_index_aliases_gin_idx
  on public.taiwan_poi_index using gin (aliases);

create index if not exists taiwan_poi_index_city_idx
  on public.taiwan_poi_index (city)
  where is_active;

create or replace function public.suggest_taiwan_pois(
  q text,
  bias_lng double precision default null,
  bias_lat double precision default null,
  max_results integer default 24
)
returns setof public.taiwan_poi_index
language sql
stable
as $$
  with needle as (
    select lower(replace(replace(trim(q), '臺', '台'), ' ', '')) as n
  )
  select poi.*
  from public.taiwan_poi_index poi, needle
  where poi.is_active
    and needle.n <> ''
    and (
      poi.name_normalized like needle.n || '%'
      or poi.name_normalized % needle.n
      or coalesce(poi.brand, '') ilike needle.n || '%'
      or exists (
        select 1
        from unnest(poi.aliases) alias
        where lower(replace(replace(alias, '臺', '台'), ' ', '')) like needle.n || '%'
      )
    )
  order by
    case
      when poi.name_normalized = needle.n then 0
      when poi.name_normalized like needle.n || '%' then 1
      else 2
    end,
    case
      when bias_lng is not null and bias_lat is not null
        then st_distance(
          poi.geom,
          st_setsrid(st_makepoint(bias_lng, bias_lat), 4326)::geography
        )
      else 0
    end,
    poi.name
  limit greatest(1, least(max_results, 48));
$$;

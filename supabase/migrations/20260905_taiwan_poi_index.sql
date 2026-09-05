create extension if not exists pg_trgm;
create extension if not exists postgis;

create table if not exists public.taiwan_poi_index (
  id text primary key,
  name text not null,
  name_normalized text not null,
  aliases text[] not null default '{}',
  category text not null,
  brand text,
  address text not null,
  county text,
  district text,
  latitude double precision not null,
  longitude double precision not null,
  source text not null,
  source_id text not null,
  updated_at timestamptz not null default now(),
  license text not null default 'ODbL',
  geom geography(point, 4326)
);

create unique index if not exists taiwan_poi_index_source_id_idx
  on public.taiwan_poi_index (source, source_id);

create index if not exists taiwan_poi_index_name_trgm_idx
  on public.taiwan_poi_index using gin (name_normalized gin_trgm_ops);

create index if not exists taiwan_poi_index_category_idx
  on public.taiwan_poi_index (category, brand);

create index if not exists taiwan_poi_index_geom_idx
  on public.taiwan_poi_index using gist (geom);

alter table public.taiwan_poi_index enable row level security;

create or replace function public.search_taiwan_pois(
  q text,
  bias_lng double precision default null,
  bias_lat double precision default null,
  max_results integer default 24
)
returns setof public.taiwan_poi_index
language sql
stable
as $$
  select *
  from public.taiwan_poi_index
  where
    name_normalized ilike '%' || replace(lower(replace(q, '臺', '台')), ' ', '') || '%'
    or name ilike '%' || q || '%'
    or address ilike '%' || q || '%'
  order by
    case
      when bias_lng is not null and bias_lat is not null
        then st_distance(
          geom,
          st_setsrid(st_makepoint(bias_lng, bias_lat), 4326)::geography
        )
      else 0
    end,
    name
  limit greatest(1, least(max_results, 48));
$$;

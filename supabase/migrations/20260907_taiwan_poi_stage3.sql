alter table public.taiwan_poi_index
  add column if not exists last_seen_at timestamptz,
  add column if not exists source_updated_at timestamptz;

create table if not exists public.poi_import_rejects (
  id bigserial primary key,
  source text not null,
  source_id text,
  reason text not null,
  raw_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists taiwan_poi_index_trgm_name_idx
  on public.taiwan_poi_index using gin (name_normalized gin_trgm_ops)
  where is_active;

create index if not exists taiwan_poi_index_geom_gix
  on public.taiwan_poi_index using gist (geom)
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
      or coalesce(poi.brand, '') ilike '%' || needle.n || '%'
      or exists (
        select 1
        from unnest(poi.aliases) alias
        where lower(replace(replace(alias, '臺', '台'), ' ', '')) like needle.n || '%'
      )
    )
    and (
      bias_lng is null
      or bias_lat is null
      or char_length(needle.n) >= 4
      or st_dwithin(
        poi.geom,
        st_setsrid(st_makepoint(bias_lng, bias_lat), 4326)::geography,
        40000
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
    poi.confidence desc,
    poi.name
  limit greatest(1, least(max_results, 48));
$$;

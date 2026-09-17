-- Phase 5.3A southern POI cloud pilot.
-- Additive only. No DROP TABLE / TRUNCATE / unconditional DELETE.

create extension if not exists postgis;
create extension if not exists pg_trgm;

alter table if exists public.taiwan_poi_index
  add column if not exists name_normalized text,
  add column if not exists aliases text[] not null default '{}',
  add column if not exists brand text,
  add column if not exists branch_name text,
  add column if not exists subcategory text,
  add column if not exists main_category text,
  add column if not exists address_normalized text,
  add column if not exists district text,
  add column if not exists phone text,
  add column if not exists opening_hours text,
  add column if not exists quality_grade text,
  add column if not exists nav_score integer,
  add column if not exists nav_ready boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists publish_status text not null default 'staging',
  add column if not exists data_version text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists taiwan_poi_index_source_source_id_uidx
  on public.taiwan_poi_index (source, source_id);

create index if not exists taiwan_poi_index_geom_gist
  on public.taiwan_poi_index using gist (geom);

create index if not exists taiwan_poi_index_name_trgm
  on public.taiwan_poi_index using gin (name_normalized gin_trgm_ops);

create index if not exists taiwan_poi_index_publish_county_cat
  on public.taiwan_poi_index (publish_status, nav_ready, is_active, county, main_category);

create table if not exists public.poi_import_runs (
  id bigserial primary key,
  job_id text not null,
  data_version text not null,
  region text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  batch_count integer not null default 0,
  success_count integer not null default 0,
  fail_count integer not null default 0,
  checksum text,
  status text not null default 'running'
);

create table if not exists public.poi_import_rejects (
  id bigserial primary key,
  source text not null,
  source_id text,
  reason text not null,
  raw_data jsonb,
  batch_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.poi_data_versions (
  version text primary key,
  license text,
  generated_at timestamptz not null default now(),
  total integer,
  hash text,
  is_current boolean not null default false
);

alter table public.taiwan_poi_index enable row level security;
alter table public.poi_import_runs enable row level security;
alter table public.poi_import_rejects enable row level security;
alter table public.poi_data_versions enable row level security;

drop policy if exists taiwan_poi_index_public_read on public.taiwan_poi_index;
create policy taiwan_poi_index_public_read
on public.taiwan_poi_index
for select
to anon, authenticated
using (
  is_active = true
  and nav_ready = true
  and publish_status = 'published'
  and county in ('雲林縣', '嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣')
);

create or replace function public.pois_in_bounds(
  west double precision,
  south double precision,
  east double precision,
  north double precision,
  layers text[] default null,
  max_results integer default 160
)
returns setof public.taiwan_poi_index
language sql
stable
as $$
  select poi.*
  from public.taiwan_poi_index poi
  where
    poi.is_active
    and poi.nav_ready
    and poi.publish_status = 'published'
    and poi.county in ('雲林縣', '嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣')
    and poi.longitude >= west
    and poi.longitude <= east
    and poi.latitude >= south
    and poi.latitude <= north
    and (
      layers is null
      or poi.main_category = any(layers)
      or (poi.main_category is null and poi.category = any(layers))
    )
    and west > 118 and east < 123 and south > 20 and north < 27
    and east > west and north > south
    and (east - west) <= 1.6
  order by poi.nav_score desc nulls last, poi.name
  limit greatest(1, least(coalesce(max_results, 160), 240));
$$;

revoke all on function public.pois_in_bounds(double precision, double precision, double precision, double precision, text[], integer) from public;
grant execute on function public.pois_in_bounds(double precision, double precision, double precision, double precision, text[], integer) to anon, authenticated;

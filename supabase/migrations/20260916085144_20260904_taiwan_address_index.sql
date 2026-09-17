create extension if not exists pg_trgm;
create extension if not exists postgis;

create table if not exists public.taiwan_address_index (
  id text primary key,
  country_code text not null default 'TW',
  county text,
  district text,
  village text,
  neighborhood text,
  road text,
  section text,
  lane text,
  alley text,
  house_number text,
  normalized_address text not null,
  display_address text not null,
  latitude double precision,
  longitude double precision,
  accuracy text not null,
  source text not null,
  source_record_id text,
  source_updated_at timestamptz,
  imported_at timestamptz not null default now(),
  license text,
  coordinate_system text not null default 'EPSG:4326',
  geom geography(point, 4326)
);

create unique index if not exists taiwan_address_index_source_record_idx
  on public.taiwan_address_index (source, source_record_id)
  where source_record_id is not null;

create index if not exists taiwan_address_index_normalized_trgm_idx
  on public.taiwan_address_index using gin (normalized_address gin_trgm_ops);

create index if not exists taiwan_address_index_place_idx
  on public.taiwan_address_index (county, district, road);

create index if not exists taiwan_address_index_geom_idx
  on public.taiwan_address_index using gist (geom);

alter table public.taiwan_address_index enable row level security;

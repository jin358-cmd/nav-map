create extension if not exists postgis;

create table if not exists public.tdx_import_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id text not null unique,
  source text not null,
  source_version text,
  dataset text not null,
  region text not null,
  batch_size integer not null,
  processed_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  last_checkpoint integer not null default 0,
  checkpoint jsonb not null default '{}',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'partial', 'failed', 'completed'))
);

create table if not exists public.tdx_staging_records (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.tdx_import_jobs(job_id) on delete cascade,
  source text not null,
  source_id text not null,
  dataset text not null,
  region text not null,
  city text,
  district text,
  source_url text,
  source_updated_at timestamptz,
  fetched_at timestamptz not null,
  normalized_at timestamptz,
  data_version text,
  raw_metadata jsonb not null,
  normalized_data jsonb,
  coordinate_valid boolean not null default false,
  within_taiwan boolean not null default false,
  validation_errors text[] not null default '{}',
  normalization_status text not null default 'pending'
    check (normalization_status in ('pending', 'accepted', 'rejected', 'promoted')),
  unique (source, dataset, region, source_id)
);

create table if not exists public.tdx_failed_records (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.tdx_import_jobs(job_id) on delete cascade,
  source text not null,
  dataset text not null,
  region text not null,
  source_id text,
  error_code text not null,
  error_message text not null,
  raw_metadata jsonb,
  failed_at timestamptz not null default now()
);

create table if not exists public.traffic_segments (
  id text primary key,
  source_id text not null,
  road_name text,
  direction text,
  geometry geometry(linestring, 4326) not null,
  city text,
  district text,
  source text not null,
  source_url text,
  source_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  raw_metadata jsonb,
  unique (source, source_id)
);

create table if not exists public.traffic_status (
  segment_id text primary key references public.traffic_segments(id) on delete cascade,
  speed double precision,
  congestion_level text,
  official_congestion_code text,
  travel_time double precision,
  source_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  stale boolean not null default false,
  raw_metadata jsonb
);

create index if not exists tdx_staging_job_checkpoint_idx
  on public.tdx_staging_records (job_id, normalization_status, source_id);
create index if not exists tdx_staging_region_idx
  on public.tdx_staging_records (region, dataset);
create index if not exists traffic_segments_geometry_idx
  on public.traffic_segments using gist (geometry);
create index if not exists traffic_status_fetched_idx
  on public.traffic_status (fetched_at desc);

alter table public.tdx_import_jobs enable row level security;
alter table public.tdx_staging_records enable row level security;
alter table public.tdx_failed_records enable row level security;
alter table public.traffic_segments enable row level security;
alter table public.traffic_status enable row level security;

alter table public.parking_lots
  add column if not exists source_url text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists fetched_at timestamptz,
  add column if not exists normalized_at timestamptz,
  add column if not exists data_version text,
  add column if not exists raw_metadata jsonb;

create or replace function public.promote_tdx_parking_job(target_job_id text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  promoted_count integer := 0;
begin
  insert into public.parking_lots (
    id,
    source,
    source_parking_id,
    name,
    address,
    latitude,
    longitude,
    total_spaces,
    car_spaces,
    operating_hours,
    city,
    district,
    is_active,
    source_url,
    source_updated_at,
    fetched_at,
    normalized_at,
    data_version,
    raw_metadata
  )
  select
    'tdx-offstreet:' || stage.region || ':' || stage.source_id,
    'tdx-offstreet',
    stage.region || ':' || stage.source_id,
    stage.normalized_data->>'name',
    stage.normalized_data->>'address',
    (stage.normalized_data->>'latitude')::double precision,
    (stage.normalized_data->>'longitude')::double precision,
    (stage.normalized_data->>'total_spaces')::integer,
    (stage.normalized_data->>'total_spaces')::integer,
    stage.normalized_data->>'operating_hours',
    stage.city,
    stage.district,
    true,
    stage.source_url,
    stage.source_updated_at,
    stage.fetched_at,
    stage.normalized_at,
    stage.data_version,
    stage.raw_metadata
  from public.tdx_staging_records stage
  where stage.job_id = target_job_id
    and stage.dataset = 'parking_offstreet_carpark'
    and stage.normalization_status = 'accepted'
  on conflict (id) do update set
    name = excluded.name,
    address = excluded.address,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    total_spaces = excluded.total_spaces,
    car_spaces = excluded.car_spaces,
    operating_hours = excluded.operating_hours,
    city = excluded.city,
    district = excluded.district,
    is_active = excluded.is_active,
    source_url = excluded.source_url,
    source_updated_at = excluded.source_updated_at,
    fetched_at = excluded.fetched_at,
    normalized_at = excluded.normalized_at,
    data_version = excluded.data_version,
    raw_metadata = excluded.raw_metadata;

  get diagnostics promoted_count = row_count;

  insert into public.parking_availability (
    parking_lot_id,
    available_spaces,
    total_spaces,
    fetched_at,
    status
  )
  select
    'tdx-offstreet:' || stage.region || ':' || stage.source_id,
    null,
    (stage.normalized_data->>'total_spaces')::integer,
    stage.fetched_at,
    'unknown'
  from public.tdx_staging_records stage
  where stage.job_id = target_job_id
    and stage.dataset = 'parking_offstreet_carpark'
    and stage.normalization_status = 'accepted'
  on conflict (parking_lot_id) do nothing;

  insert into public.parking_rates (
    parking_lot_id,
    vehicle_type,
    rate_type,
    rate_description,
    updated_at
  )
  select
    'tdx-offstreet:' || stage.region || ':' || stage.source_id,
    'car',
    'unknown',
    nullif(stage.normalized_data->>'rate_description', ''),
    coalesce(stage.normalized_at, now())
  from public.tdx_staging_records stage
  where stage.job_id = target_job_id
    and stage.dataset = 'parking_offstreet_carpark'
    and stage.normalization_status = 'accepted'
  on conflict (parking_lot_id, vehicle_type, rate_type) do update set
    rate_description = excluded.rate_description,
    updated_at = excluded.updated_at;

  update public.tdx_staging_records
  set normalization_status = 'promoted'
  where job_id = target_job_id
    and dataset = 'parking_offstreet_carpark'
    and normalization_status = 'accepted';

  return promoted_count;
end;
$$;

revoke all on function public.promote_tdx_parking_job(text) from public;
revoke all on function public.promote_tdx_parking_job(text) from anon;
revoke all on function public.promote_tdx_parking_job(text) from authenticated;
grant execute on function public.promote_tdx_parking_job(text) to service_role;

create extension if not exists postgis;

create table if not exists public.parking_lots (
  id text primary key,
  source text not null,
  source_parking_id text not null,
  name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  total_spaces integer,
  car_spaces integer,
  motorcycle_spaces integer,
  disabled_spaces integer,
  operating_hours text,
  phone text,
  operator text,
  city text,
  district text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  geom geography(point, 4326),
  unique (source, source_parking_id)
);

create table if not exists public.parking_availability (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id text not null references public.parking_lots(id) on delete cascade,
  available_spaces integer,
  total_spaces integer,
  occupancy_rate double precision,
  data_timestamp timestamptz,
  fetched_at timestamptz not null default now(),
  status text not null default 'unknown',
  unique (parking_lot_id)
);

create table if not exists public.parking_rates (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id text not null references public.parking_lots(id) on delete cascade,
  vehicle_type text not null default 'car',
  rate_type text not null default 'unknown',
  hourly_rate numeric,
  daily_max numeric,
  rate_description text,
  updated_at timestamptz not null default now(),
  unique (parking_lot_id, vehicle_type, rate_type)
);

create table if not exists public.parking_sync_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  fetched_records integer not null default 0,
  inserted_records integer not null default 0,
  updated_records integer not null default 0,
  failed_records integer not null default 0,
  status text not null,
  error_message text
);

create index if not exists parking_lots_city_idx
  on public.parking_lots (city, is_active);

create index if not exists parking_lots_geom_idx
  on public.parking_lots using gist (geom);

create index if not exists parking_availability_fetched_idx
  on public.parking_availability (fetched_at desc);

create index if not exists parking_sync_logs_source_idx
  on public.parking_sync_logs (source, started_at desc);

create or replace function public.parking_lots_set_geom()
returns trigger
language plpgsql
as $$
begin
  new.geom := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists parking_lots_set_geom on public.parking_lots;
create trigger parking_lots_set_geom
before insert or update of latitude, longitude
on public.parking_lots
for each row
execute function public.parking_lots_set_geom();

create or replace function public.search_nearby_parking_lots(
  center_lng double precision,
  center_lat double precision,
  radius_meters double precision default 1000,
  max_results integer default 80
)
returns table (
  id text,
  source text,
  source_parking_id text,
  name text,
  address text,
  latitude double precision,
  longitude double precision,
  total_spaces integer,
  car_spaces integer,
  motorcycle_spaces integer,
  disabled_spaces integer,
  operating_hours text,
  phone text,
  operator text,
  city text,
  district text,
  is_active boolean,
  updated_at timestamptz,
  distance_meters double precision,
  available_spaces integer,
  availability_total integer,
  occupancy_rate double precision,
  data_timestamp timestamptz,
  fetched_at timestamptz,
  availability_status text,
  vehicle_type text,
  rate_type text,
  hourly_rate numeric,
  daily_max numeric,
  rate_description text
)
language sql
stable
as $$
  select
    lot.id,
    lot.source,
    lot.source_parking_id,
    lot.name,
    lot.address,
    lot.latitude,
    lot.longitude,
    lot.total_spaces,
    lot.car_spaces,
    lot.motorcycle_spaces,
    lot.disabled_spaces,
    lot.operating_hours,
    lot.phone,
    lot.operator,
    lot.city,
    lot.district,
    lot.is_active,
    lot.updated_at,
    st_distance(
      lot.geom,
      st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography
    ) as distance_meters,
    avail.available_spaces,
    avail.total_spaces as availability_total,
    avail.occupancy_rate,
    avail.data_timestamp,
    avail.fetched_at,
    avail.status as availability_status,
    rates.vehicle_type,
    rates.rate_type,
    rates.hourly_rate,
    rates.daily_max,
    rates.rate_description
  from public.parking_lots lot
  left join public.parking_availability avail
    on avail.parking_lot_id = lot.id
  left join lateral (
    select *
    from public.parking_rates
    where parking_lot_id = lot.id
    order by
      case vehicle_type when 'car' then 0 else 1 end,
      updated_at desc
    limit 1
  ) rates on true
  where
    lot.is_active
    and lot.geom is not null
    and st_dwithin(
      lot.geom,
      st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography,
      greatest(200, least(radius_meters, 8000))
    )
  order by distance_meters
  limit greatest(1, least(max_results, 120));
$$;

alter table public.parking_lots enable row level security;
alter table public.parking_availability enable row level security;
alter table public.parking_rates enable row level security;
alter table public.parking_sync_logs enable row level security;

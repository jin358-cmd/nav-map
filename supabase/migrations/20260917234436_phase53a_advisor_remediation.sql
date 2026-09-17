-- Phase 5.3A advisor remediation.
-- No DROP TABLE / TRUNCATE / unconditional DELETE.

-- Keep the existing public POI search RPC, but prevent mutable search_path.
alter function public.search_taiwan_pois(
  text,
  double precision,
  double precision,
  integer
) security invoker;

alter function public.search_taiwan_pois(
  text,
  double precision,
  double precision,
  integer
) set search_path = public;

revoke all on function public.search_taiwan_pois(
  text,
  double precision,
  double precision,
  integer
) from public;

grant execute on function public.search_taiwan_pois(
  text,
  double precision,
  double precision,
  integer
) to anon, authenticated;

-- These PostGIS metadata functions are not NavPilot public APIs.
revoke execute on function public.st_estimatedextent(text, text)
from public, anon, authenticated;

revoke execute on function public.st_estimatedextent(text, text, text)
from public, anon, authenticated;

revoke execute on function public.st_estimatedextent(text, text, text, boolean)
from public, anon, authenticated;

-- Keep one copy of each identical POI index.
drop index if exists public.taiwan_poi_index_name_trgm;
drop index if exists public.taiwan_poi_index_geom_gist;
drop index if exists public.taiwan_poi_index_source_source_id_uidx;

-- PostGIS reference data is readable but never writable by app roles.
alter table public.spatial_ref_sys enable row level security;

drop policy if exists spatial_ref_sys_public_read
on public.spatial_ref_sys;

create policy spatial_ref_sys_public_read
on public.spatial_ref_sys
for select
to anon, authenticated
using (true);

revoke insert, update, delete, truncate
on table public.spatial_ref_sys
from anon, authenticated;

-- Phase 5.3A cloud hardening. Additive grants/RPC only.
-- No DROP TABLE / TRUNCATE / unconditional DELETE.

grant usage on schema public to anon, authenticated;

grant select on table public.taiwan_poi_index
to anon, authenticated;

grant select on table public.taiwan_address_index
to anon, authenticated;

revoke insert, update, delete on table public.taiwan_poi_index
from anon, authenticated;

revoke insert, update, delete on table public.taiwan_address_index
from anon, authenticated;

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
security invoker
set search_path = public
as $$
  select poi.*
  from public.taiwan_poi_index poi
  where
    poi.is_active
    and poi.nav_ready
    and poi.publish_status = 'published'
    and poi.county in ('雲林縣', '嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣')
    and poi.longitude is not null
    and poi.latitude is not null
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

revoke all on function public.pois_in_bounds(
  double precision,
  double precision,
  double precision,
  double precision,
  text[],
  integer
) from public;

grant execute on function public.pois_in_bounds(
  double precision,
  double precision,
  double precision,
  double precision,
  text[],
  integer
) to anon, authenticated;

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
security invoker
set search_path = public
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
    and poi.latitude is not null
    and poi.longitude is not null
    and (
      poi.normalized_address ilike '%' || q || '%'
      or poi.canonical_address_key ilike '%' || replace(lower(q), '台', '臺') || '%'
    )
  order by poi.quality_score desc nulls last, poi.normalized_address
  limit greatest(1, least(coalesce(max_results, 12), 24));
$$;

revoke all on function public.search_taiwan_addresses(text, integer)
from public;

grant execute on function public.search_taiwan_addresses(text, integer)
to anon, authenticated;

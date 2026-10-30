-- NavPilot delivery courier ratings.
-- Apply only to project rxzbsthsqlozxgctdoks, and only after review.
-- New table only. Does not alter the tables from 20261030133000_delivery_portal.sql.
-- Writes are service-role only. anon cannot read ratings.

create table if not exists public.delivery_courier_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.delivery_orders (id) on delete cascade,
  courier_id text not null,
  customer_id text not null,
  stars integer not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 80),
  created_at timestamptz not null default now()
);

create index if not exists delivery_courier_ratings_courier_idx
  on public.delivery_courier_ratings (courier_id);

alter table public.delivery_courier_ratings enable row level security;
alter table public.delivery_courier_ratings force row level security;

revoke all on table public.delivery_courier_ratings from public, anon, authenticated;

grant select on table public.delivery_courier_ratings to authenticated;

drop policy if exists delivery_courier_ratings_customer_select on public.delivery_courier_ratings;
create policy delivery_courier_ratings_customer_select
  on public.delivery_courier_ratings
  for select
  to authenticated
  using (customer_id = (select auth.uid()::text));

drop policy if exists delivery_courier_ratings_courier_select on public.delivery_courier_ratings;
create policy delivery_courier_ratings_courier_select
  on public.delivery_courier_ratings
  for select
  to authenticated
  using (courier_id = (select auth.uid()::text));

comment on table public.delivery_courier_ratings is
  'One rating per delivered NavPilot order. Service role writes. anon has no access.';

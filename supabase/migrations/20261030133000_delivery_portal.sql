-- NavPilot delivery portal.
-- Apply only to project rxzbsthsqlozxgctdoks, and only after review.
-- New tables only. Does not alter existing tables, policies, or functions.
-- Writes are service-role only. anon cannot read orders or locations.

create table if not exists public.delivery_stores (
  id text primary key,
  name text not null,
  address text not null,
  lng double precision not null,
  lat double precision not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_menu_items (
  id text primary key,
  store_id text not null references public.delivery_stores (id) on delete cascade,
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_couriers (
  id text primary key,
  display_name text not null,
  online boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_courier_locations (
  courier_id text primary key references public.delivery_couriers (id) on delete cascade,
  lng double precision not null,
  lat double precision not null,
  heading double precision,
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null,
  store_id text not null references public.delivery_stores (id),
  status text not null check (
    status in (
      'created',
      'awaiting_dispatch',
      'assigned',
      'picked_up',
      'delivered',
      'cancelled'
    )
  ),
  dispatch_mode text not null check (dispatch_mode in ('nearest', 'grab')),
  items jsonb not null,
  amount_cents integer not null default 0 check (amount_cents = 0),
  payment_status text not null default 'skipped' check (payment_status = 'skipped'),
  pickup_label text not null,
  pickup_lng double precision not null,
  pickup_lat double precision not null,
  dropoff_label text not null,
  dropoff_lng double precision not null,
  dropoff_lat double precision not null,
  customer_lng double precision,
  customer_lat double precision,
  customer_location_at timestamptz,
  courier_id text,
  offered_courier_id text,
  offer_expires_at timestamptz,
  declined_courier_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_orders (id) on delete cascade,
  event_type text not null,
  actor_role text,
  actor_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists delivery_menu_items_store_idx
  on public.delivery_menu_items (store_id);

create index if not exists delivery_orders_customer_idx
  on public.delivery_orders (customer_id, created_at desc);

create index if not exists delivery_orders_open_status_idx
  on public.delivery_orders (status)
  where status in ('created', 'awaiting_dispatch', 'assigned', 'picked_up');

create index if not exists delivery_orders_offered_idx
  on public.delivery_orders (offered_courier_id)
  where offered_courier_id is not null;

create index if not exists delivery_orders_courier_idx
  on public.delivery_orders (courier_id)
  where courier_id is not null;

create index if not exists delivery_order_events_order_idx
  on public.delivery_order_events (order_id, created_at);

-- One active delivery and one live offer per courier.
create unique index if not exists delivery_orders_one_active_per_courier
  on public.delivery_orders (courier_id)
  where courier_id is not null
    and status in ('assigned', 'picked_up');

create unique index if not exists delivery_orders_one_offer_per_courier
  on public.delivery_orders (offered_courier_id)
  where offered_courier_id is not null
    and status = 'awaiting_dispatch';

alter table public.delivery_stores enable row level security;
alter table public.delivery_menu_items enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.delivery_order_events enable row level security;
alter table public.delivery_couriers enable row level security;
alter table public.delivery_courier_locations enable row level security;

alter table public.delivery_stores force row level security;
alter table public.delivery_menu_items force row level security;
alter table public.delivery_orders force row level security;
alter table public.delivery_order_events force row level security;
alter table public.delivery_couriers force row level security;
alter table public.delivery_courier_locations force row level security;

revoke all on table public.delivery_stores from public, anon, authenticated;
revoke all on table public.delivery_menu_items from public, anon, authenticated;
revoke all on table public.delivery_orders from public, anon, authenticated;
revoke all on table public.delivery_order_events from public, anon, authenticated;
revoke all on table public.delivery_couriers from public, anon, authenticated;
revoke all on table public.delivery_courier_locations from public, anon, authenticated;

-- Catalog only. No personal data.
grant select on table public.delivery_stores to anon, authenticated;
grant select on table public.delivery_menu_items to anon, authenticated;

drop policy if exists delivery_stores_public_read on public.delivery_stores;
create policy delivery_stores_public_read
  on public.delivery_stores
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists delivery_menu_items_public_read on public.delivery_menu_items;
create policy delivery_menu_items_public_read
  on public.delivery_menu_items
  for select
  to anon, authenticated
  using (active = true);

-- Orders: a future Supabase Auth user may read only their own row.
-- Couriers read an order only when it is offered to them or assigned to them.
-- Grab broadcasts are filtered by radius in the gateway. They are not granted
-- to every authenticated user, so anon and unrelated users cannot list them.
grant select on table public.delivery_orders to authenticated;

drop policy if exists delivery_orders_customer_select on public.delivery_orders;
create policy delivery_orders_customer_select
  on public.delivery_orders
  for select
  to authenticated
  using (customer_id = (select auth.uid()::text));

drop policy if exists delivery_orders_courier_select on public.delivery_orders;
create policy delivery_orders_courier_select
  on public.delivery_orders
  for select
  to authenticated
  using (
    courier_id = (select auth.uid()::text)
    or offered_courier_id = (select auth.uid()::text)
  );

grant select on table public.delivery_order_events to authenticated;

drop policy if exists delivery_order_events_customer_select on public.delivery_order_events;
create policy delivery_order_events_customer_select
  on public.delivery_order_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.delivery_orders as orders
      where orders.id = delivery_order_events.order_id
        and orders.customer_id = (select auth.uid()::text)
    )
  );

drop policy if exists delivery_order_events_courier_select on public.delivery_order_events;
create policy delivery_order_events_courier_select
  on public.delivery_order_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.delivery_orders as orders
      where orders.id = delivery_order_events.order_id
        and (
          orders.courier_id = (select auth.uid()::text)
          or orders.offered_courier_id = (select auth.uid()::text)
        )
    )
  );

grant select on table public.delivery_couriers to authenticated;

drop policy if exists delivery_couriers_own_select on public.delivery_couriers;
create policy delivery_couriers_own_select
  on public.delivery_couriers
  for select
  to authenticated
  using (id = (select auth.uid()::text));

drop policy if exists delivery_couriers_assigned_customer_select on public.delivery_couriers;
create policy delivery_couriers_assigned_customer_select
  on public.delivery_couriers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.delivery_orders as orders
      where orders.courier_id = delivery_couriers.id
        and orders.customer_id = (select auth.uid()::text)
        and orders.status in ('assigned', 'picked_up', 'delivered')
    )
  );

-- Locations: own row, or the customer of an assigned/picked-up order.
-- anon has no grant and no policy.
grant select on table public.delivery_courier_locations to authenticated;

drop policy if exists delivery_courier_locations_own_select on public.delivery_courier_locations;
create policy delivery_courier_locations_own_select
  on public.delivery_courier_locations
  for select
  to authenticated
  using (courier_id = (select auth.uid()::text));

drop policy if exists delivery_courier_locations_customer_select on public.delivery_courier_locations;
create policy delivery_courier_locations_customer_select
  on public.delivery_courier_locations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.delivery_orders as orders
      where orders.courier_id = delivery_courier_locations.courier_id
        and orders.customer_id = (select auth.uid()::text)
        and orders.status in ('assigned', 'picked_up')
    )
  );

comment on table public.delivery_orders is
  'NavPilot delivery orders. Service role writes. Customers read own rows; couriers read offered or assigned rows.';

comment on table public.delivery_courier_locations is
  'Live courier GPS. anon cannot select. Customers can see a courier only while that courier is assigned to their order.';

insert into public.delivery_stores (id, name, address, lng, lat)
values
  ('store-anping', '安平海鮮便當', '臺南市安平區安平路', 120.1605, 22.9932),
  ('store-guohua', '國華街米粉湯', '臺南市中西區國華街', 120.1935, 22.9972),
  ('store-east', '東區咖啡', '臺南市東區東門路', 120.2224, 22.9841)
on conflict (id) do nothing;

insert into public.delivery_menu_items (id, store_id, name, price_cents)
values
  ('anping-bento', 'store-anping', '招牌便當', 0),
  ('anping-soup', 'store-anping', '魚湯', 0),
  ('guohua-rice', 'store-guohua', '米粉湯', 0),
  ('guohua-bowl', 'store-guohua', '肉燥飯', 0),
  ('east-coffee', 'store-east', '美式咖啡', 0),
  ('east-cake', 'store-east', '蛋糕切片', 0)
on conflict (id) do nothing;

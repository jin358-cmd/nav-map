create table if not exists public.address_search_cache (
  id uuid primary key default gen_random_uuid(),
  query_hash text not null unique,
  original_query text not null,
  normalized_query text not null,
  response_data jsonb not null,
  primary_source text,
  hit_count bigint not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists
  address_search_cache_normalized_query_idx
on public.address_search_cache (normalized_query);

create index if not exists
  address_search_cache_expires_at_idx
on public.address_search_cache (expires_at);

alter table public.address_search_cache enable row level security;

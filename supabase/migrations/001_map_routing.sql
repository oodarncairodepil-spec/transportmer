create extension if not exists pgcrypto;

create table if not exists public.map_routes (
  id uuid primary key default gen_random_uuid(),
  title text,
  origin jsonb not null,
  destination jsonb not null,
  stops jsonb not null default '[]'::jsonb,
  truck_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.map_route_recommendations (
  id uuid primary key default gen_random_uuid(),
  map_route_id uuid not null references public.map_routes(id) on delete cascade,
  provider text not null,
  route_id text,
  score double precision,
  is_truck_safe boolean not null default false,
  violations jsonb not null default '[]'::jsonb,
  polyline text,
  geometry jsonb,
  segments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_map_route_reco_route_id on public.map_route_recommendations(map_route_id);

alter table public.map_routes enable row level security;
alter table public.map_route_recommendations enable row level security;

drop policy if exists "public_read_map_routes" on public.map_routes;
create policy "public_read_map_routes" on public.map_routes
for select
to anon, authenticated
using (true);

drop policy if exists "public_write_map_routes" on public.map_routes;
create policy "public_write_map_routes" on public.map_routes
for insert
to anon, authenticated
with check (true);

drop policy if exists "public_update_map_routes" on public.map_routes;
create policy "public_update_map_routes" on public.map_routes
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public_delete_map_routes" on public.map_routes;
create policy "public_delete_map_routes" on public.map_routes
for delete
to anon, authenticated
using (true);

drop policy if exists "public_read_map_route_recommendations" on public.map_route_recommendations;
create policy "public_read_map_route_recommendations" on public.map_route_recommendations
for select
to anon, authenticated
using (true);

drop policy if exists "public_write_map_route_recommendations" on public.map_route_recommendations;
create policy "public_write_map_route_recommendations" on public.map_route_recommendations
for insert
to anon, authenticated
with check (true);

drop policy if exists "public_delete_map_route_recommendations" on public.map_route_recommendations;
create policy "public_delete_map_route_recommendations" on public.map_route_recommendations
for delete
to anon, authenticated
using (true);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_map_routes_updated_at on public.map_routes;
create trigger trg_touch_map_routes_updated_at
before update on public.map_routes
for each row
execute procedure public.touch_updated_at();


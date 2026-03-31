create extension if not exists pgcrypto;

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text,
  origin_label text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_label text not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_routes_user_id_created_at
  on public.routes(user_id, created_at desc);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null,
  user_id uuid not null,
  position int not null,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  source text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_route_stops_route_id_pos
  on public.route_stops(route_id, position);

create index if not exists idx_route_stops_user_id
  on public.route_stops(user_id);

alter table public.routes enable row level security;
alter table public.route_stops enable row level security;

drop policy if exists routes_select_own on public.routes;
create policy routes_select_own
  on public.routes for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists routes_insert_own on public.routes;
create policy routes_insert_own
  on public.routes for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists routes_update_own on public.routes;
create policy routes_update_own
  on public.routes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists routes_delete_own on public.routes;
create policy routes_delete_own
  on public.routes for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists route_stops_select_own on public.route_stops;
create policy route_stops_select_own
  on public.route_stops for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists route_stops_insert_own on public.route_stops;
create policy route_stops_insert_own
  on public.route_stops for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists route_stops_update_own on public.route_stops;
create policy route_stops_update_own
  on public.route_stops for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists route_stops_delete_own on public.route_stops;
create policy route_stops_delete_own
  on public.route_stops for delete
  to authenticated
  using (user_id = auth.uid());

grant select on public.routes to anon;
grant all privileges on public.routes to authenticated;

grant select on public.route_stops to anon;
grant all privileges on public.route_stops to authenticated;


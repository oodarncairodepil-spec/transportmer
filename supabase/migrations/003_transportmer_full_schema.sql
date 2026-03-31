create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.staff_profiles (
  user_id uuid primary key,
  email text not null,
  name text not null,
  phone text,
  title text,
  role text not null default 'staff',
  must_change_password boolean not null default true,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_profiles_role
  on public.staff_profiles(role);

drop trigger if exists trg_touch_staff_profiles_updated_at on public.staff_profiles;
create trigger trg_touch_staff_profiles_updated_at
before update on public.staff_profiles
for each row
execute procedure public.touch_updated_at();

create table if not exists public.fleet_trucks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  legacy_id text,
  plate_number text not null,
  plate_month text,
  plate_year text,
  type text not null,
  status text not null,
  location text,
  mileage bigint not null default 0,
  fuel_level int not null default 0,
  last_service date,
  next_service date,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_fleet_trucks_user_legacy_id
  on public.fleet_trucks(user_id, legacy_id);

create index if not exists idx_fleet_trucks_user_created_at
  on public.fleet_trucks(user_id, created_at desc);

drop trigger if exists trg_touch_fleet_trucks_updated_at on public.fleet_trucks;
create trigger trg_touch_fleet_trucks_updated_at
before update on public.fleet_trucks
for each row
execute procedure public.touch_updated_at();

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  legacy_id text,
  name text not null,
  license_type text,
  license_valid_month text,
  license_valid_year text,
  status text not null,
  phone text,
  rating double precision,
  total_trips int not null default 0,
  assigned_truck_id uuid,
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_drivers_user_legacy_id
  on public.drivers(user_id, legacy_id);

create index if not exists idx_drivers_user_created_at
  on public.drivers(user_id, created_at desc);

drop trigger if exists trg_touch_drivers_updated_at on public.drivers;
create trigger trg_touch_drivers_updated_at
before update on public.drivers
for each row
execute procedure public.touch_updated_at();

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists idx_locations_user_created_at
  on public.locations(user_id, created_at desc);

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

drop trigger if exists trg_touch_routes_updated_at on public.routes;
create trigger trg_touch_routes_updated_at
before update on public.routes
for each row
execute procedure public.touch_updated_at();

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
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

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  legacy_id text,
  title text not null,
  driver_id uuid,
  truck_id uuid,
  route_name text,
  destinations jsonb not null default '[]'::jsonb,
  notes text,
  priority text not null,
  status text not null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_work_orders_user_legacy_id
  on public.work_orders(user_id, legacy_id);

create index if not exists idx_work_orders_user_due_date
  on public.work_orders(user_id, due_date desc);

drop trigger if exists trg_touch_work_orders_updated_at on public.work_orders;
create trigger trg_touch_work_orders_updated_at
before update on public.work_orders
for each row
execute procedure public.touch_updated_at();

create table if not exists public.work_order_history (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  user_id uuid not null,
  message text,
  attachment_name text,
  attachment_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_order_history_work_order_id
  on public.work_order_history(work_order_id, created_at desc);

create index if not exists idx_work_order_history_user_id
  on public.work_order_history(user_id);

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  truck_id uuid,
  type text not null,
  status text not null,
  date date not null,
  notes text not null,
  cost numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_maintenance_records_user_date
  on public.maintenance_records(user_id, date desc);

create index if not exists idx_maintenance_records_truck_id
  on public.maintenance_records(truck_id);

drop trigger if exists trg_touch_maintenance_records_updated_at on public.maintenance_records;
create trigger trg_touch_maintenance_records_updated_at
before update on public.maintenance_records
for each row
execute procedure public.touch_updated_at();

create table if not exists public.schedule_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_schedule_templates_user_type
  on public.schedule_templates(user_id, type, title);

drop trigger if exists trg_touch_schedule_templates_updated_at on public.schedule_templates;
create trigger trg_touch_schedule_templates_updated_at
before update on public.schedule_templates
for each row
execute procedure public.touch_updated_at();

create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  driver_id uuid,
  date date not null,
  type text not null,
  title text not null,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_schedule_events_user_date
  on public.schedule_events(user_id, date desc);

create index if not exists idx_schedule_events_driver_id
  on public.schedule_events(driver_id, date desc);

drop trigger if exists trg_touch_schedule_events_updated_at on public.schedule_events;
create trigger trg_touch_schedule_events_updated_at
before update on public.schedule_events
for each row
execute procedure public.touch_updated_at();

create table if not exists public.map_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
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
  user_id uuid not null,
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

create index if not exists idx_map_routes_user_created_at
  on public.map_routes(user_id, created_at desc);

create index if not exists idx_map_route_reco_route_id
  on public.map_route_recommendations(map_route_id);

create index if not exists idx_map_route_reco_user_id
  on public.map_route_recommendations(user_id);

drop trigger if exists trg_touch_map_routes_updated_at on public.map_routes;
create trigger trg_touch_map_routes_updated_at
before update on public.map_routes
for each row
execute procedure public.touch_updated_at();

alter table public.fleet_trucks enable row level security;
alter table public.drivers enable row level security;
alter table public.locations enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_history enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.schedule_templates enable row level security;
alter table public.schedule_events enable row level security;
alter table public.map_routes enable row level security;
alter table public.map_route_recommendations enable row level security;

drop policy if exists staff_profiles_admin_full on public.staff_profiles;
create policy staff_profiles_admin_full
  on public.staff_profiles
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists staff_profiles_staff_read_own on public.staff_profiles;
create policy staff_profiles_staff_read_own
  on public.staff_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists fleet_trucks_select_own on public.fleet_trucks;
create policy fleet_trucks_select_own on public.fleet_trucks for select to authenticated using (user_id = auth.uid());
drop policy if exists fleet_trucks_insert_own on public.fleet_trucks;
create policy fleet_trucks_insert_own on public.fleet_trucks for insert to authenticated with check (user_id = auth.uid());
drop policy if exists fleet_trucks_update_own on public.fleet_trucks;
create policy fleet_trucks_update_own on public.fleet_trucks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists fleet_trucks_delete_own on public.fleet_trucks;
create policy fleet_trucks_delete_own on public.fleet_trucks for delete to authenticated using (user_id = auth.uid());

drop policy if exists drivers_select_own on public.drivers;
create policy drivers_select_own on public.drivers for select to authenticated using (user_id = auth.uid());
drop policy if exists drivers_insert_own on public.drivers;
create policy drivers_insert_own on public.drivers for insert to authenticated with check (user_id = auth.uid());
drop policy if exists drivers_update_own on public.drivers;
create policy drivers_update_own on public.drivers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists drivers_delete_own on public.drivers;
create policy drivers_delete_own on public.drivers for delete to authenticated using (user_id = auth.uid());

drop policy if exists locations_select_own on public.locations;
create policy locations_select_own on public.locations for select to authenticated using (user_id = auth.uid());
drop policy if exists locations_insert_own on public.locations;
create policy locations_insert_own on public.locations for insert to authenticated with check (user_id = auth.uid());
drop policy if exists locations_update_own on public.locations;
create policy locations_update_own on public.locations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists locations_delete_own on public.locations;
create policy locations_delete_own on public.locations for delete to authenticated using (user_id = auth.uid());

drop policy if exists routes_select_own on public.routes;
create policy routes_select_own on public.routes for select to authenticated using (user_id = auth.uid());
drop policy if exists routes_insert_own on public.routes;
create policy routes_insert_own on public.routes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists routes_update_own on public.routes;
create policy routes_update_own on public.routes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists routes_delete_own on public.routes;
create policy routes_delete_own on public.routes for delete to authenticated using (user_id = auth.uid());

drop policy if exists route_stops_select_own on public.route_stops;
create policy route_stops_select_own on public.route_stops for select to authenticated using (user_id = auth.uid());
drop policy if exists route_stops_insert_own on public.route_stops;
create policy route_stops_insert_own on public.route_stops for insert to authenticated with check (user_id = auth.uid());
drop policy if exists route_stops_update_own on public.route_stops;
create policy route_stops_update_own on public.route_stops for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists route_stops_delete_own on public.route_stops;
create policy route_stops_delete_own on public.route_stops for delete to authenticated using (user_id = auth.uid());

drop policy if exists work_orders_select_own on public.work_orders;
create policy work_orders_select_own on public.work_orders for select to authenticated using (user_id = auth.uid());
drop policy if exists work_orders_insert_own on public.work_orders;
create policy work_orders_insert_own on public.work_orders for insert to authenticated with check (user_id = auth.uid());
drop policy if exists work_orders_update_own on public.work_orders;
create policy work_orders_update_own on public.work_orders for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists work_orders_delete_own on public.work_orders;
create policy work_orders_delete_own on public.work_orders for delete to authenticated using (user_id = auth.uid());

drop policy if exists work_order_history_select_own on public.work_order_history;
create policy work_order_history_select_own on public.work_order_history for select to authenticated using (user_id = auth.uid());
drop policy if exists work_order_history_insert_own on public.work_order_history;
create policy work_order_history_insert_own on public.work_order_history for insert to authenticated with check (user_id = auth.uid());
drop policy if exists work_order_history_update_own on public.work_order_history;
create policy work_order_history_update_own on public.work_order_history for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists work_order_history_delete_own on public.work_order_history;
create policy work_order_history_delete_own on public.work_order_history for delete to authenticated using (user_id = auth.uid());

drop policy if exists maintenance_records_select_own on public.maintenance_records;
create policy maintenance_records_select_own on public.maintenance_records for select to authenticated using (user_id = auth.uid());
drop policy if exists maintenance_records_insert_own on public.maintenance_records;
create policy maintenance_records_insert_own on public.maintenance_records for insert to authenticated with check (user_id = auth.uid());
drop policy if exists maintenance_records_update_own on public.maintenance_records;
create policy maintenance_records_update_own on public.maintenance_records for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists maintenance_records_delete_own on public.maintenance_records;
create policy maintenance_records_delete_own on public.maintenance_records for delete to authenticated using (user_id = auth.uid());

drop policy if exists schedule_templates_select_own on public.schedule_templates;
create policy schedule_templates_select_own on public.schedule_templates for select to authenticated using (user_id = auth.uid());
drop policy if exists schedule_templates_insert_own on public.schedule_templates;
create policy schedule_templates_insert_own on public.schedule_templates for insert to authenticated with check (user_id = auth.uid());
drop policy if exists schedule_templates_update_own on public.schedule_templates;
create policy schedule_templates_update_own on public.schedule_templates for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists schedule_templates_delete_own on public.schedule_templates;
create policy schedule_templates_delete_own on public.schedule_templates for delete to authenticated using (user_id = auth.uid());

drop policy if exists schedule_events_select_own on public.schedule_events;
create policy schedule_events_select_own on public.schedule_events for select to authenticated using (user_id = auth.uid());
drop policy if exists schedule_events_insert_own on public.schedule_events;
create policy schedule_events_insert_own on public.schedule_events for insert to authenticated with check (user_id = auth.uid());
drop policy if exists schedule_events_update_own on public.schedule_events;
create policy schedule_events_update_own on public.schedule_events for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists schedule_events_delete_own on public.schedule_events;
create policy schedule_events_delete_own on public.schedule_events for delete to authenticated using (user_id = auth.uid());

drop policy if exists map_routes_select_own on public.map_routes;
create policy map_routes_select_own on public.map_routes for select to authenticated using (user_id = auth.uid());
drop policy if exists map_routes_insert_own on public.map_routes;
create policy map_routes_insert_own on public.map_routes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists map_routes_update_own on public.map_routes;
create policy map_routes_update_own on public.map_routes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists map_routes_delete_own on public.map_routes;
create policy map_routes_delete_own on public.map_routes for delete to authenticated using (user_id = auth.uid());

drop policy if exists map_route_recommendations_select_own on public.map_route_recommendations;
create policy map_route_recommendations_select_own on public.map_route_recommendations for select to authenticated using (user_id = auth.uid());
drop policy if exists map_route_recommendations_insert_own on public.map_route_recommendations;
create policy map_route_recommendations_insert_own on public.map_route_recommendations for insert to authenticated with check (user_id = auth.uid());
drop policy if exists map_route_recommendations_update_own on public.map_route_recommendations;
create policy map_route_recommendations_update_own on public.map_route_recommendations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists map_route_recommendations_delete_own on public.map_route_recommendations;
create policy map_route_recommendations_delete_own on public.map_route_recommendations for delete to authenticated using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;

grant select on public.fleet_trucks to authenticated;
grant select on public.drivers to authenticated;
grant select on public.locations to authenticated;
grant select on public.staff_profiles to authenticated;
grant select on public.routes to authenticated;
grant select on public.route_stops to authenticated;
grant select on public.work_orders to authenticated;
grant select on public.work_order_history to authenticated;
grant select on public.maintenance_records to authenticated;
grant select on public.schedule_templates to authenticated;
grant select on public.schedule_events to authenticated;
grant select on public.map_routes to authenticated;
grant select on public.map_route_recommendations to authenticated;

grant insert, update, delete on public.fleet_trucks to authenticated;
grant insert, update, delete on public.drivers to authenticated;
grant insert, update, delete on public.locations to authenticated;
grant insert, update, delete on public.staff_profiles to authenticated;
grant insert, update, delete on public.routes to authenticated;
grant insert, update, delete on public.route_stops to authenticated;
grant insert, update, delete on public.work_orders to authenticated;
grant insert, update, delete on public.work_order_history to authenticated;
grant insert, update, delete on public.maintenance_records to authenticated;
grant insert, update, delete on public.schedule_templates to authenticated;
grant insert, update, delete on public.schedule_events to authenticated;
grant insert, update, delete on public.map_routes to authenticated;
grant insert, update, delete on public.map_route_recommendations to authenticated;

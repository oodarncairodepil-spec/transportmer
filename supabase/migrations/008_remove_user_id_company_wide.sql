-- Company-wide shared data: remove per-user ownership columns and relax RLS to allow all authenticated users.

-- Drop existing RLS policies that reference user_id
drop policy if exists fleet_trucks_select_own on public.fleet_trucks;
drop policy if exists fleet_trucks_insert_own on public.fleet_trucks;
drop policy if exists fleet_trucks_update_own on public.fleet_trucks;
drop policy if exists fleet_trucks_delete_own on public.fleet_trucks;

drop policy if exists drivers_select_own on public.drivers;
drop policy if exists drivers_insert_own on public.drivers;
drop policy if exists drivers_update_own on public.drivers;
drop policy if exists drivers_delete_own on public.drivers;

drop policy if exists locations_select_own on public.locations;
drop policy if exists locations_insert_own on public.locations;
drop policy if exists locations_update_own on public.locations;
drop policy if exists locations_delete_own on public.locations;

drop policy if exists routes_select_own on public.routes;
drop policy if exists routes_insert_own on public.routes;
drop policy if exists routes_update_own on public.routes;
drop policy if exists routes_delete_own on public.routes;

drop policy if exists route_stops_select_own on public.route_stops;
drop policy if exists route_stops_insert_own on public.route_stops;
drop policy if exists route_stops_update_own on public.route_stops;
drop policy if exists route_stops_delete_own on public.route_stops;

drop policy if exists work_orders_select_own on public.work_orders;
drop policy if exists work_orders_insert_own on public.work_orders;
drop policy if exists work_orders_update_own on public.work_orders;
drop policy if exists work_orders_delete_own on public.work_orders;

drop policy if exists work_order_history_select_own on public.work_order_history;
drop policy if exists work_order_history_insert_own on public.work_order_history;
drop policy if exists work_order_history_update_own on public.work_order_history;
drop policy if exists work_order_history_delete_own on public.work_order_history;

drop policy if exists maintenance_records_select_own on public.maintenance_records;
drop policy if exists maintenance_records_insert_own on public.maintenance_records;
drop policy if exists maintenance_records_update_own on public.maintenance_records;
drop policy if exists maintenance_records_delete_own on public.maintenance_records;

drop policy if exists schedule_templates_select_own on public.schedule_templates;
drop policy if exists schedule_templates_insert_own on public.schedule_templates;
drop policy if exists schedule_templates_update_own on public.schedule_templates;
drop policy if exists schedule_templates_delete_own on public.schedule_templates;

drop policy if exists schedule_events_select_own on public.schedule_events;
drop policy if exists schedule_events_insert_own on public.schedule_events;
drop policy if exists schedule_events_update_own on public.schedule_events;
drop policy if exists schedule_events_delete_own on public.schedule_events;

drop policy if exists map_routes_select_own on public.map_routes;
drop policy if exists map_routes_insert_own on public.map_routes;
drop policy if exists map_routes_update_own on public.map_routes;
drop policy if exists map_routes_delete_own on public.map_routes;

drop policy if exists map_route_recommendations_select_own on public.map_route_recommendations;
drop policy if exists map_route_recommendations_insert_own on public.map_route_recommendations;
drop policy if exists map_route_recommendations_update_own on public.map_route_recommendations;
drop policy if exists map_route_recommendations_delete_own on public.map_route_recommendations;

drop policy if exists "public_read_map_routes" on public.map_routes;
drop policy if exists "public_write_map_routes" on public.map_routes;
drop policy if exists "public_update_map_routes" on public.map_routes;
drop policy if exists "public_delete_map_routes" on public.map_routes;
drop policy if exists "public_read_map_route_recommendations" on public.map_route_recommendations;
drop policy if exists "public_write_map_route_recommendations" on public.map_route_recommendations;
drop policy if exists "public_delete_map_route_recommendations" on public.map_route_recommendations;

drop policy if exists "public_read_map_route_segments" on public.map_route_segments;
drop policy if exists "public_write_map_route_segments" on public.map_route_segments;
drop policy if exists "public_delete_map_route_segments" on public.map_route_segments;

-- Drop company-wide policies if a previous run partially succeeded
drop policy if exists fleet_trucks_authenticated_all on public.fleet_trucks;
drop policy if exists drivers_authenticated_all on public.drivers;
drop policy if exists locations_authenticated_all on public.locations;
drop policy if exists routes_authenticated_all on public.routes;
drop policy if exists route_stops_authenticated_all on public.route_stops;
drop policy if exists work_orders_authenticated_all on public.work_orders;
drop policy if exists work_order_history_authenticated_all on public.work_order_history;
drop policy if exists maintenance_records_authenticated_all on public.maintenance_records;
drop policy if exists schedule_templates_authenticated_all on public.schedule_templates;
drop policy if exists schedule_events_authenticated_all on public.schedule_events;
drop policy if exists map_routes_authenticated_all on public.map_routes;
drop policy if exists map_route_recommendations_authenticated_all on public.map_route_recommendations;
drop policy if exists map_route_segments_authenticated_all on public.map_route_segments;

-- Drop indexes that depend on user_id (they will be recreated without user_id)
drop index if exists public.idx_fleet_trucks_user_legacy_id;
drop index if exists public.idx_fleet_trucks_user_created_at;
drop index if exists public.idx_drivers_user_legacy_id;
drop index if exists public.idx_drivers_user_created_at;
drop index if exists public.idx_locations_user_created_at;
drop index if exists public.idx_routes_user_id_created_at;
drop index if exists public.idx_route_stops_user_id;
drop index if exists public.idx_work_orders_user_legacy_id;
drop index if exists public.idx_work_orders_user_due_date;
drop index if exists public.idx_work_order_history_user_id;
drop index if exists public.idx_maintenance_records_user_date;
drop index if exists public.idx_schedule_templates_user_type;
drop index if exists public.idx_schedule_events_user_date;
drop index if exists public.idx_map_routes_user_created_at;
drop index if exists public.idx_map_route_reco_user_id;

drop index if exists public.idx_locations_user_label_lat_lng;
drop index if exists public.idx_routes_user_legacy_id;

-- Remove user_id columns (staff_profiles.user_id must remain)
alter table public.fleet_trucks drop column if exists user_id;
alter table public.drivers drop column if exists user_id;
alter table public.locations drop column if exists user_id;
alter table public.routes drop column if exists user_id;
alter table public.route_stops drop column if exists user_id;
alter table public.work_orders drop column if exists user_id;
alter table public.work_order_history drop column if exists user_id;
alter table public.maintenance_records drop column if exists user_id;
alter table public.schedule_templates drop column if exists user_id;
alter table public.schedule_events drop column if exists user_id;
alter table public.map_routes drop column if exists user_id;
alter table public.map_route_recommendations drop column if exists user_id;

-- Recreate indexes without user_id
with ranked_fleet as (
  select ctid, row_number() over (partition by legacy_id order by created_at desc) as rn
  from public.fleet_trucks
  where legacy_id is not null
)
delete from public.fleet_trucks t using ranked_fleet r
where t.ctid = r.ctid and r.rn > 1;

create unique index if not exists idx_fleet_trucks_legacy_id on public.fleet_trucks(legacy_id);
create index if not exists idx_fleet_trucks_created_at on public.fleet_trucks(created_at desc);

with ranked_drivers as (
  select ctid, row_number() over (partition by legacy_id order by created_at desc) as rn
  from public.drivers
  where legacy_id is not null
)
delete from public.drivers d using ranked_drivers r
where d.ctid = r.ctid and r.rn > 1;

create unique index if not exists idx_drivers_legacy_id on public.drivers(legacy_id);
create index if not exists idx_drivers_created_at on public.drivers(created_at desc);

create index if not exists idx_locations_created_at on public.locations(created_at desc);

with ranked_routes as (
  select ctid, row_number() over (partition by legacy_id order by created_at desc) as rn
  from public.routes
  where legacy_id is not null and legacy_id <> ''
)
delete from public.routes r using ranked_routes x
where r.ctid = x.ctid and x.rn > 1;

create index if not exists idx_routes_created_at on public.routes(created_at desc);
create unique index if not exists idx_routes_legacy_id on public.routes(legacy_id);

with ranked_work_orders as (
  select ctid, row_number() over (partition by legacy_id order by created_at desc) as rn
  from public.work_orders
  where legacy_id is not null
)
delete from public.work_orders o using ranked_work_orders r
where o.ctid = r.ctid and r.rn > 1;

create unique index if not exists idx_work_orders_legacy_id on public.work_orders(legacy_id);
create index if not exists idx_work_orders_due_date on public.work_orders(due_date desc);

create index if not exists idx_work_order_history_created_at on public.work_order_history(created_at desc);

create index if not exists idx_maintenance_records_date on public.maintenance_records(date desc);

create index if not exists idx_schedule_templates_type on public.schedule_templates(type);
create index if not exists idx_schedule_events_date on public.schedule_events(date desc);

create index if not exists idx_map_routes_created_at on public.map_routes(created_at desc);
create index if not exists idx_map_route_reco_created_at on public.map_route_recommendations(created_at desc);

with ranked_locations as (
  select
    ctid,
    row_number() over (
      partition by lower(label), lat, lng
      order by
        (case when coalesce(kind, 'Other') <> 'Other' then 1 else 0 end) desc,
        created_at desc
    ) as rn
  from public.locations
)
delete from public.locations l
using ranked_locations r
where l.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists idx_locations_label_lat_lng on public.locations(lower(label), lat, lng);

-- Ensure RLS is enabled, but allow all authenticated users to access all rows
alter table public.fleet_trucks enable row level security;
alter table public.drivers enable row level security;
alter table public.locations enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_history enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.schedule_templates enable row level security;
alter table public.schedule_events enable row level security;
alter table public.map_routes enable row level security;
alter table public.map_route_recommendations enable row level security;
alter table public.map_route_segments enable row level security;

create policy fleet_trucks_authenticated_all on public.fleet_trucks for all to authenticated using (true) with check (true);
create policy drivers_authenticated_all on public.drivers for all to authenticated using (true) with check (true);
create policy locations_authenticated_all on public.locations for all to authenticated using (true) with check (true);
create policy routes_authenticated_all on public.routes for all to authenticated using (true) with check (true);
create policy route_stops_authenticated_all on public.route_stops for all to authenticated using (true) with check (true);
create policy work_orders_authenticated_all on public.work_orders for all to authenticated using (true) with check (true);
create policy work_order_history_authenticated_all on public.work_order_history for all to authenticated using (true) with check (true);
create policy maintenance_records_authenticated_all on public.maintenance_records for all to authenticated using (true) with check (true);
create policy schedule_templates_authenticated_all on public.schedule_templates for all to authenticated using (true) with check (true);
create policy schedule_events_authenticated_all on public.schedule_events for all to authenticated using (true) with check (true);
create policy map_routes_authenticated_all on public.map_routes for all to authenticated using (true) with check (true);
create policy map_route_recommendations_authenticated_all on public.map_route_recommendations for all to authenticated using (true) with check (true);
create policy map_route_segments_authenticated_all on public.map_route_segments for all to authenticated using (true) with check (true);

-- Remove public (anon) access for internal company app
revoke all on public.fleet_trucks from anon;
revoke all on public.drivers from anon;
revoke all on public.locations from anon;
revoke all on public.routes from anon;
revoke all on public.route_stops from anon;
revoke all on public.work_orders from anon;
revoke all on public.work_order_history from anon;
revoke all on public.maintenance_records from anon;
revoke all on public.schedule_templates from anon;
revoke all on public.schedule_events from anon;
revoke all on public.map_routes from anon;
revoke all on public.map_route_recommendations from anon;
revoke all on public.map_route_segments from anon;

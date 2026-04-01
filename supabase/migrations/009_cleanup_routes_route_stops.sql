-- Cleanup duplicates in routes and route_stops after switching to company-wide (no user_id).

-- 1) Ensure routes.legacy_id exists (in case migration 007 was skipped)
alter table public.routes
add column if not exists legacy_id text;

-- 2) Remove duplicate routes by legacy_id (keep newest)
with ranked_routes as (
  select ctid, row_number() over (partition by legacy_id order by created_at desc) as rn
  from public.routes
  where legacy_id is not null and legacy_id <> ''
)
delete from public.routes r
using ranked_routes x
where r.ctid = x.ctid
  and x.rn > 1;

-- 3) Remove duplicate route_stops per route/position (keep newest)
with ranked_stops as (
  select
    ctid,
    row_number() over (partition by route_id, position order by created_at desc) as rn
  from public.route_stops
)
delete from public.route_stops s
using ranked_stops x
where s.ctid = x.ctid
  and x.rn > 1;

-- 4) Enforce uniqueness going forward
create unique index if not exists idx_routes_legacy_id on public.routes(legacy_id);
create unique index if not exists idx_route_stops_route_id_pos on public.route_stops(route_id, position);


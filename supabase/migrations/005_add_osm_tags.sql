create table if not exists public.map_route_segments (
  id uuid primary key default gen_random_uuid(),
  map_route_recommendation_id uuid not null references public.map_route_recommendations(id) on delete cascade,
  highway text,
  maxspeed text,
  lanes text,
  maxweight text,
  maxheight text,
  way text,
  score double precision,
  matched boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_map_route_segments_reco_id on public.map_route_segments(map_route_recommendation_id);

alter table public.map_route_segments enable row level security;

drop policy if exists "public_read_map_route_segments" on public.map_route_segments;
create policy "public_read_map_route_segments" on public.map_route_segments
for select
to anon, authenticated
using (true);

drop policy if exists "public_write_map_route_segments" on public.map_route_segments;
create policy "public_write_map_route_segments" on public.map_route_segments
for insert
to anon, authenticated
with check (true);

drop policy if exists "public_delete_map_route_segments" on public.map_route_segments;
create policy "public_delete_map_route_segments" on public.map_route_segments
for delete
to anon, authenticated
using (true);
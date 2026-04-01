with ranked as (
  select
    ctid,
    row_number() over (
      partition by user_id, lower(label), lat, lng
      order by
        (case when coalesce(kind, 'Other') <> 'Other' then 1 else 0 end) desc,
        created_at desc
    ) as rn
  from public.locations
)
delete from public.locations l
using ranked r
where l.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists idx_locations_user_label_lat_lng
  on public.locations(user_id, lower(label), lat, lng);

alter table public.routes
add column if not exists legacy_id text;

create unique index if not exists idx_routes_user_legacy_id
  on public.routes(user_id, legacy_id);

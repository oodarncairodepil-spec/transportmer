-- Enforce uniqueness and prevent duplicates for company-wide schedules.

with ranked_templates as (
  select
    ctid,
    row_number() over (
      partition by type, lower(title)
      order by created_at desc
    ) as rn
  from public.schedule_templates
)
delete from public.schedule_templates t
using ranked_templates r
where t.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists idx_schedule_templates_type_title
  on public.schedule_templates(type, lower(title));

with ranked_events as (
  select
    ctid,
    row_number() over (
      partition by driver_id, date
      order by created_at desc
    ) as rn
  from public.schedule_events
)
delete from public.schedule_events e
using ranked_events r
where e.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists idx_schedule_events_driver_date
  on public.schedule_events(driver_id, date);


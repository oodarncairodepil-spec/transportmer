alter table public.locations
add column if not exists kind text not null default 'Other';


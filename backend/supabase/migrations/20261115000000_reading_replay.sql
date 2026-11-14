alter table public.readings add column source_id uuid;
create unique index readings_tank_source_id_idx on public.readings (tank_id, source_id)
  where source_id is not null;

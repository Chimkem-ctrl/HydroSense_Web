insert into public.tanks (id, name, site, rearing_start_date, device_id)
values
  ('00000000-0000-0000-0000-000000000001', 'Tank 01', 'Camiguin, Sagay Multispecies Hatchery', '2026-11-01', 'HS-001'),
  ('00000000-0000-0000-0000-000000000002', 'Tank 02', 'Camiguin, Sagay Multispecies Hatchery', '2026-11-01', 'HS-002'),
  ('00000000-0000-0000-0000-000000000003', 'Tank 03', 'Camiguin, Sagay Multispecies Hatchery', '2026-11-01', 'HS-003')
on conflict (id) do update set
  name = excluded.name,
  site = excluded.site,
  rearing_start_date = excluded.rearing_start_date,
  device_id = excluded.device_id;

insert into public.device_statuses (device_id, online, last_seen, battery_pct, power_source, wifi_rssi, pending_sync_count)
values
  ('HS-001', true, now(), 92, 'solar', -51, 0),
  ('HS-002', true, now(), 88, 'solar', -58, 0),
  ('HS-003', true, now(), 84, 'battery', -62, 0)
on conflict (device_id) do update set
  online = excluded.online,
  last_seen = excluded.last_seen,
  battery_pct = excluded.battery_pct,
  power_source = excluded.power_source,
  wifi_rssi = excluded.wifi_rssi,
  pending_sync_count = excluded.pending_sync_count;

insert into public.readings (tank_id, timestamp, temperature, do_mg_l, ph)
select tank.id, now() - offset_time, temperature, do_mg_l, ph
from (
  values
    ('00000000-0000-0000-0000-000000000001'::uuid, interval '0 minutes', 29.7::double precision, 7.3::double precision, 7.2::double precision),
    ('00000000-0000-0000-0000-000000000001'::uuid, interval '30 minutes', 29.6::double precision, 7.2::double precision, 7.2::double precision),
    ('00000000-0000-0000-0000-000000000002'::uuid, interval '0 minutes', 29.2::double precision, 6.8::double precision, 7.4::double precision),
    ('00000000-0000-0000-0000-000000000002'::uuid, interval '30 minutes', 29.1::double precision, 6.9::double precision, 7.3::double precision),
    ('00000000-0000-0000-0000-000000000003'::uuid, interval '0 minutes', 28.9::double precision, 6.5::double precision, 7.1::double precision),
    ('00000000-0000-0000-0000-000000000003'::uuid, interval '30 minutes', 28.8::double precision, 6.4::double precision, 7.1::double precision)
) seed(tank_id, offset_time, temperature, do_mg_l, ph)
join public.tanks tank on tank.id = seed.tank_id
where not exists (
  select 1
  from public.readings existing
  where existing.tank_id = seed.tank_id
);

alter table public.readings
  add column if not exists ec_u_s_cm double precision,
  add column if not exists salinity_ppm double precision,
  add column if not exists tds_ppm double precision,
  add column if not exists do_saturation_pct double precision,
  add column if not exists do_probe_temperature double precision;

create extension if not exists pgcrypto;

create type hydrosense_role as enum ('operator', 'manager', 'admin');
create type account_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null unique,
  role hydrosense_role,
  requested_role hydrosense_role,
  status account_status not null default 'pending',
  position text,
  site text not null default '',
  employee_id text,
  phone text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  active boolean not null default true,
  last_active timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint no_admin_request check (requested_role is null or requested_role <> 'admin'),
  constraint approved_role_matches_status check (
    (status = 'approved' and role in ('operator', 'manager', 'admin'))
    or (status <> 'approved' and role is null)
  )
);

create table public.tanks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  site text not null,
  rearing_start_date date not null,
  device_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid not null references public.tanks(id) on delete cascade,
  timestamp timestamptz not null default now(),
  temperature double precision not null,
  do_mg_l double precision not null,
  ph double precision not null
);
create index readings_tank_timestamp_idx on public.readings(tank_id, timestamp desc);

create table public.device_statuses (
  device_id text primary key,
  online boolean not null default false,
  last_seen timestamptz not null default now(),
  battery_pct integer not null,
  power_source text not null check (power_source in ('solar', 'grid', 'battery')),
  wifi_rssi integer not null,
  pending_sync_count integer not null default 0
);

create table public.thresholds (
  parameter text primary key check (parameter in ('temperature', 'do', 'ph')),
  min_value double precision,
  max_value double precision,
  updated_at timestamptz not null default now()
);

create table public.advisory_settings (
  id boolean primary key default true check (id),
  salinity_watch_temperature_c double precision not null default 31,
  salinity_high_temperature_c double precision not null default 33,
  ammonia_watch_temperature_c double precision not null default 30,
  ammonia_high_ph double precision not null default 8
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid not null references public.tanks(id) on delete cascade,
  parameter text not null,
  value double precision not null,
  threshold text not null,
  severity text not null check (severity in ('warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  acknowledged_by text,
  acknowledged_at timestamptz,
  note text
);

create table public.alert_responses (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  status text not null check (status in ('open', 'acknowledged', 'resolved')),
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by text not null
);

create table public.manual_entries (
  id uuid primary key default gen_random_uuid(),
  tank_id text not null,
  type text not null,
  value double precision,
  unit text,
  timestamp timestamptz not null default now(),
  entered_by text not null,
  note text
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  tank_id text not null,
  kind text not null,
  type text not null,
  occurred_at timestamptz not null default now(),
  operator text not null,
  notes text not null default '',
  water_change_percent double precision,
  water_source text,
  impact text,
  manual_readings jsonb
);

create table public.calibration_logs (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid not null references public.tanks(id) on delete cascade,
  parameter text not null check (parameter in ('ph', 'do')),
  standard text not null,
  before_value double precision not null,
  after_value double precision not null,
  date date not null,
  user_name text not null,
  next_due date not null
);

create table public.validation_rows (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid references public.tanks(id) on delete cascade,
  parameter text not null,
  hydrosense_mean double precision not null,
  reference double precision not null,
  error double precision not null,
  pct_error double precision not null,
  tolerance double precision not null,
  pass boolean not null
);

create table public.validation_tolerances (
  id boolean primary key default true check (id),
  temperature double precision not null default 1,
  ph double precision not null default 0.2,
  dissolved_oxygen double precision not null default 0.5
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  user_name text not null,
  action text not null,
  detail text not null default ''
);

insert into public.thresholds(parameter, min_value, max_value) values
  ('temperature', 28, 32), ('do', 5, null), ('ph', 7.2, 8.5);
insert into public.advisory_settings(id) values (true);
insert into public.validation_tolerances(id) values (true);

create function public.current_profile_role()
returns hydrosense_role language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.profiles enable row level security;
alter table public.tanks enable row level security;
alter table public.readings enable row level security;
alter table public.device_statuses enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_responses enable row level security;

create policy "approved users can read profiles" on public.profiles
  for select using (auth.uid() = id or public.current_profile_role() in ('manager', 'admin'));
create policy "approved users can read tanks" on public.tanks
  for select using (public.current_profile_role() is not null);
create policy "approved users can read readings" on public.readings
  for select using (public.current_profile_role() is not null);
create policy "approved users can read devices" on public.device_statuses
  for select using (public.current_profile_role() is not null);
create policy "approved users can read alerts" on public.alerts
  for select using (public.current_profile_role() is not null);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, first_name, last_name, email, requested_role, status, position)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'firstName', ''),
    coalesce(new.raw_user_meta_data->>'lastName', ''),
    new.email,
    nullif(new.raw_user_meta_data->>'requestedRole', '')::hydrosense_role,
    'pending',
    coalesce(new.raw_user_meta_data->>'position', null)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter publication supabase_realtime add table public.readings, public.device_statuses, public.alerts;

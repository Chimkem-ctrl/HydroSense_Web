create table public.sms_alert_queue (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  tank_id uuid not null references public.tanks(id) on delete cascade,
  phone text not null,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'sent', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  unique (alert_id, phone)
);

alter table public.sms_alert_queue enable row level security;
create index sms_alert_queue_pending_idx on public.sms_alert_queue (tank_id, created_at) where status = 'pending';

create function public.enqueue_alert_sms() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tank_name text;
  sms_message text;
begin
  select left(regexp_replace(name, '[^a-zA-Z0-9 ._-]', '', 'g'), 40)
    into tank_name from public.tanks where id = new.tank_id;
  sms_message := format('HydroSense %s: %s %s = %s. Check the app.',
    tank_name, new.severity, left(regexp_replace(new.parameter, '[^a-zA-Z0-9 _-]', '', 'g'), 20), new.value);
  insert into public.sms_alert_queue (alert_id, tank_id, phone, message)
    select distinct new.id, new.tank_id, phone, left(sms_message, 150)
    from public.profiles
    where status = 'approved' and phone ~ '^\+[1-9][0-9]{6,14}$'
    on conflict (alert_id, phone) do nothing;
  if exists (select 1 from public.profiles where status = 'approved'
             and (phone is null or phone !~ '^\+[1-9][0-9]{6,14}$')) then
    raise warning 'Approved profiles with missing or non-E.164 phone numbers were skipped for alert %', new.id;
  end if;
  return new;
end;
$$;

create trigger alerts_enqueue_sms after insert on public.alerts
for each row execute function public.enqueue_alert_sms();

create function public.claim_alert_sms(p_tank_id uuid)
returns setof public.sms_alert_queue
language plpgsql security definer set search_path = public as $$
begin
  update public.sms_alert_queue q
  set status = 'cancelled', completed_at = now()
  where q.tank_id = p_tank_id and q.status = 'pending'
    and not exists (
      select 1 from public.profiles p where p.status = 'approved' and p.phone = q.phone
    );
  return query update public.sms_alert_queue
  set status = 'claimed', claimed_at = now()
  where id = (
    select id from public.sms_alert_queue
    where tank_id = p_tank_id and status = 'pending'
    order by created_at, id
    for update skip locked limit 1
  )
  returning *;
end;
$$;

revoke all on function public.enqueue_alert_sms() from public, anon, authenticated;
revoke all on function public.claim_alert_sms(uuid) from public, anon, authenticated;
grant execute on function public.claim_alert_sms(uuid) to service_role;

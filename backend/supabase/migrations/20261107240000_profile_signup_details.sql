create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles(
    id,
    first_name,
    last_name,
    email,
    requested_role,
    status,
    position,
    employee_id,
    phone,
    address,
    emergency_contact_name,
    emergency_contact_phone,
    site
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'firstName', ''),
    coalesce(new.raw_user_meta_data->>'lastName', ''),
    new.email,
    nullif(new.raw_user_meta_data->>'requestedRole', '')::hydrosense_role,
    'pending',
    coalesce(new.raw_user_meta_data->>'position', null),
    coalesce(new.raw_user_meta_data->>'employeeId', null),
    coalesce(new.raw_user_meta_data->>'phone', null),
    coalesce(new.raw_user_meta_data->>'address', null),
    coalesce(new.raw_user_meta_data->>'emergencyContactName', null),
    coalesce(new.raw_user_meta_data->>'emergencyContactPhone', null),
    coalesce(new.raw_user_meta_data->>'hatcheryId', '')
  )
  on conflict (id) do update set
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    position = coalesce(excluded.position, public.profiles.position),
    employee_id = coalesce(excluded.employee_id, public.profiles.employee_id),
    phone = coalesce(excluded.phone, public.profiles.phone),
    address = coalesce(excluded.address, public.profiles.address),
    emergency_contact_name = coalesce(excluded.emergency_contact_name, public.profiles.emergency_contact_name),
    emergency_contact_phone = coalesce(excluded.emergency_contact_phone, public.profiles.emergency_contact_phone),
    site = coalesce(nullif(excluded.site, ''), public.profiles.site);
  return new;
end;
$$;

update public.profiles as profile
set
  first_name = coalesce(nullif(profile.first_name, ''), nullif(auth_user.raw_user_meta_data->>'firstName', ''), profile.first_name),
  last_name = coalesce(nullif(profile.last_name, ''), nullif(auth_user.raw_user_meta_data->>'lastName', ''), profile.last_name),
  position = coalesce(profile.position, nullif(auth_user.raw_user_meta_data->>'position', '')),
  employee_id = coalesce(profile.employee_id, nullif(auth_user.raw_user_meta_data->>'employeeId', '')),
  phone = coalesce(profile.phone, nullif(auth_user.raw_user_meta_data->>'phone', '')),
  address = coalesce(profile.address, nullif(auth_user.raw_user_meta_data->>'address', '')),
  emergency_contact_name = coalesce(profile.emergency_contact_name, nullif(auth_user.raw_user_meta_data->>'emergencyContactName', '')),
  emergency_contact_phone = coalesce(profile.emergency_contact_phone, nullif(auth_user.raw_user_meta_data->>'emergencyContactPhone', '')),
  site = coalesce(nullif(profile.site, ''), nullif(auth_user.raw_user_meta_data->>'hatcheryId', ''), profile.site)
from auth.users as auth_user
where profile.id = auth_user.id;

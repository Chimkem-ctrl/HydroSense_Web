grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "approved users can read profiles" on public.profiles;
create policy "users can read their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "admins and managers can read profiles" on public.profiles;
create policy "admins and managers can read profiles"
  on public.profiles for select
  to authenticated
  using (public.current_profile_role() in ('manager', 'admin'));

create policy "admins can update profiles"
  on public.profiles for update
  to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

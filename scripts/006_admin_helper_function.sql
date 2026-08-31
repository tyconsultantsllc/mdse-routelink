-- Replace the repeated inline "is this user an admin" subquery with a single
-- SECURITY DEFINER helper. The original users_select_admin policy queried
-- public.users from within a policy defined on public.users itself — it
-- worked (the subquery reads the caller's own row via users_select_own), but
-- it's a known Supabase footgun that can trip "infinite recursion detected
-- in policy" errors depending on how policies combine. A SECURITY DEFINER
-- function sidesteps RLS entirely for this one well-scoped check.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- users
drop policy if exists "users_select_admin" on public.users;
create policy "users_select_admin" on public.users
  for select using (public.is_admin());

-- pharmacies
drop policy if exists "pharmacies_modify_admin" on public.pharmacies;
create policy "pharmacies_modify_admin" on public.pharmacies
  for all using (public.is_admin());

-- drivers
drop policy if exists "drivers_select_admin" on public.drivers;
create policy "drivers_select_admin" on public.drivers
  for select using (public.is_admin());

drop policy if exists "drivers_modify_admin" on public.drivers;
create policy "drivers_modify_admin" on public.drivers
  for all using (public.is_admin());

-- routes
drop policy if exists "routes_modify_admin" on public.routes;
create policy "routes_modify_admin" on public.routes
  for all using (public.is_admin());

-- route_stops
drop policy if exists "route_stops_modify_admin" on public.route_stops;
create policy "route_stops_modify_admin" on public.route_stops
  for all using (public.is_admin());

-- pharmacy_users
drop policy if exists "pharmacy_users_select_admin" on public.pharmacy_users;
create policy "pharmacy_users_select_admin" on public.pharmacy_users
  for select using (public.is_admin());

-- delivery_logs (created in 005_scope_read_policies.sql)
drop policy if exists "delivery_logs_select_admin" on public.delivery_logs;
create policy "delivery_logs_select_admin" on public.delivery_logs
  for select using (public.is_admin());

drop policy if exists "delivery_logs_insert_driver_admin" on public.delivery_logs;
create policy "delivery_logs_insert_driver_admin" on public.delivery_logs
  for insert with check (
    auth.uid() in (select id from public.drivers) or public.is_admin()
  );

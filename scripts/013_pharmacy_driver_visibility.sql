-- A pharmacy needs to see which driver delivered to them (for delivery
-- history), but no existing policy lets a pharmacy user read anything from
-- drivers or the linked users row for someone other than themselves. Scope
-- this narrowly: only drivers who have an actual route stop at that
-- pharmacy become visible, not the full driver roster.

CREATE POLICY "drivers_select_pharmacy" ON public.drivers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.routes r
      JOIN public.route_stops rs ON rs.route_id = r.id
      JOIN public.pharmacy_users pu ON pu.pharmacy_id = rs.pharmacy_id
      WHERE r.driver_id = drivers.id AND pu.id = auth.uid()
    )
  );

CREATE POLICY "users_select_driver_for_pharmacy" ON public.users
  FOR SELECT USING (
    role = 'driver'
    AND EXISTS (
      SELECT 1 FROM public.routes r
      JOIN public.route_stops rs ON rs.route_id = r.id
      JOIN public.pharmacy_users pu ON pu.pharmacy_id = rs.pharmacy_id
      WHERE r.driver_id = users.id AND pu.id = auth.uid()
    )
  );

-- Scope down the SELECT policies that let any authenticated user read
-- every route, pharmacy, stop, and delivery log in the system.
-- Admin dashboards are unaffected: app/actions/data-actions.ts reads through
-- the service-role client, which bypasses RLS entirely and does its own
-- role check in verifyAuth(). This migration only affects the driver and
-- pharmacy portals, which query Supabase directly from the browser.

-- ── pharmacies ──────────────────────────────────────────────
DROP POLICY IF EXISTS "pharmacies_select_all" ON public.pharmacies;

CREATE POLICY "pharmacies_select_scoped" ON public.pharmacies
  FOR SELECT USING (
    -- a pharmacy account can see its own pharmacy
    EXISTS (
      SELECT 1 FROM public.pharmacy_users pu
      WHERE pu.pharmacy_id = pharmacies.id AND pu.id = auth.uid()
    )
    -- a driver can see pharmacies that are stops on one of their routes
    OR EXISTS (
      SELECT 1 FROM public.route_stops rs
      JOIN public.routes r ON r.id = rs.route_id
      WHERE rs.pharmacy_id = pharmacies.id AND r.driver_id = auth.uid()
    )
  );
  -- admins already have full access via pharmacies_modify_admin (FOR ALL)

-- ── routes ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "routes_select_all" ON public.routes;

CREATE POLICY "routes_select_scoped" ON public.routes
  FOR SELECT USING (
    driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.route_stops rs
      JOIN public.pharmacy_users pu ON pu.pharmacy_id = rs.pharmacy_id
      WHERE rs.route_id = routes.id AND pu.id = auth.uid()
    )
  );
  -- admins already have full access via routes_modify_admin (FOR ALL)

-- ── route_stops ─────────────────────────────────────────────
DROP POLICY IF EXISTS "route_stops_select_all" ON public.route_stops;

CREATE POLICY "route_stops_select_scoped" ON public.route_stops
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.routes r
      WHERE r.id = route_stops.route_id AND r.driver_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pharmacy_users pu
      WHERE pu.pharmacy_id = route_stops.pharmacy_id AND pu.id = auth.uid()
    )
  );
  -- admins already have full access via route_stops_modify_admin (FOR ALL)

-- ── delivery_logs ───────────────────────────────────────────
DROP POLICY IF EXISTS "delivery_logs_select_all" ON public.delivery_logs;

CREATE POLICY "delivery_logs_select_scoped" ON public.delivery_logs
  FOR SELECT USING (
    driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pharmacy_users pu
      WHERE pu.pharmacy_id = delivery_logs.pharmacy_id AND pu.id = auth.uid()
    )
  );

-- delivery_logs never had an admin-specific SELECT policy (only the broad
-- one above). Adding one explicitly for defense in depth, even though the
-- admin dashboard already reads this table via the service-role client.
CREATE POLICY "delivery_logs_select_admin" ON public.delivery_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

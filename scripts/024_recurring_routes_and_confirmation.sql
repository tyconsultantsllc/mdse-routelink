-- A route_series is the template for a repeating route: which days of the
-- week it runs, over what date range, and what the route itself looks like
-- (driver, times, priority, stops). Each matching date gets its own real
-- row in routes, linked back here via series_id - occurrences are fully
-- independent routes with their own stops and status, not virtual/computed
-- rows, so an admin can freely edit or the driver can freely work any given
-- day without affecting the others.
CREATE TABLE IF NOT EXISTS public.route_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  start_time_of_day TIME,
  end_time_of_day TIME,
  estimated_duration INTEGER,
  -- 0=Sunday .. 6=Saturday
  days_of_week INTEGER[] NOT NULL,
  series_start_date DATE NOT NULL,
  series_end_date DATE NOT NULL,
  -- Template stops copied into every generated occurrence:
  -- [{ pharmacyId, pickupAddress, dropoffAddress, sequence }, ...]
  stops_template JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.route_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_series_select_all" ON public.route_series
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "route_series_modify_admin" ON public.route_series
  FOR ALL USING (public.is_admin());

-- Links an occurrence back to the series that generated it, and tracks
-- whether the assigned driver has confirmed it. Confirmation is informational
-- only - it does not gate starting a delivery, per explicit decision.
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.route_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_confirmation TEXT NOT NULL DEFAULT 'pending'
    CHECK (driver_confirmation IN ('pending', 'confirmed', 'declined')),
  ADD COLUMN IF NOT EXISTS declined_reason TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_resolved_at TIMESTAMP WITH TIME ZONE;

-- Routes with no assigned driver have nothing to confirm - default them to
-- 'confirmed' retroactively so existing unassigned/admin-only rows don't
-- show up as pending confirmations with no driver to confirm them.
UPDATE public.routes SET driver_confirmation = 'confirmed' WHERE driver_id IS NULL;

-- Per-pharmacy opt-in for customer-facing delivery tracking links, and an
-- unguessable tracking code on every route_stop so a public page can look
-- up a single delivery's status without any login. The code is generated
-- at the database level so it's automatic for every existing and future
-- stop with no app-code changes needed at insert time.

ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS customer_tracking_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS tracking_code UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS route_stops_tracking_code_idx
  ON public.route_stops (tracking_code);

-- Tracking lookups are served through a server action using the admin
-- client (so the app fully controls which columns are ever returned to an
-- anonymous visitor), not through a public RLS policy - RLS restricts rows,
-- not columns, and this data includes patient-identifying fields that must
-- never reach the public tracking page.

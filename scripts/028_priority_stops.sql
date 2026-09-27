-- Lets an admin flag any individual stop within a route as a priority stop
-- and give it a designated delivery time - e.g. "this one has to go out by
-- 2:30 PM" - separate from the route-level priority field, which only
-- describes the route as a whole and can't call out one stop among several.
--
-- designated_time is a plain time-of-day (no date) since the stop's actual
-- date already comes from the parent route/occurrence - the admin is only
-- ever picking a clock time in the create/edit route forms.

ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS designated_time TIME;

-- Recurring series store their stops as a JSONB template (stops_template on
-- route_series) rather than real columns, so isPriority/designatedTime on
-- each template stop just ride along in that JSON automatically - no schema
-- change needed there.

CREATE INDEX IF NOT EXISTS idx_route_stops_is_priority
  ON public.route_stops(route_id) WHERE is_priority = true;

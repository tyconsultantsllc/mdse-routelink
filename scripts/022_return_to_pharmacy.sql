-- Widen route_stops.status to allow 'returned' - a failed delivery that has
-- since been physically returned to the pharmacy and confirmed by signature.
ALTER TABLE public.route_stops DROP CONSTRAINT IF EXISTS route_stops_status_check;
ALTER TABLE public.route_stops ADD CONSTRAINT route_stops_status_check
  CHECK (status IN ('pending', 'picked_up', 'delivered', 'failed', 'returned'));

-- Mirrors recipient_name / signature_path / actual_delivery_time, but for
-- the return-to-pharmacy confirmation rather than the original delivery.
-- return_signature_path may be shared across multiple stops when a pharmacy
-- has chosen the "one signature for the whole batch" preference - it's the
-- same uploaded image referenced by every stop in that batch, not a new
-- upload per stop.
ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS return_confirmed_by TEXT,
  ADD COLUMN IF NOT EXISTS return_signature_path TEXT,
  ADD COLUMN IF NOT EXISTS return_confirmed_at TIMESTAMP WITH TIME ZONE;

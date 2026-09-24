-- Opt-in barcode scanning per pharmacy, matching the pattern used for
-- customer tracking and return-signature-mode. Scanning is advisory only -
-- it never blocks the existing pickup/delivery buttons, it just tries to
-- match what's scanned against what was recorded as packed, and records
-- anything that doesn't match for admin visibility.

ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS barcode_scanning_enabled BOOLEAN NOT NULL DEFAULT false;

-- One row per physical package expected for a stop. A stop can have more
-- than one (e.g. multiple prescriptions in one delivery), so this is a
-- child table rather than a single column on route_stops. packed_at is set
-- when pharmacy staff scan it while preparing the route; picked_up_at and
-- delivered_at are set when a driver's scan matches this same barcode at
-- each later stage, giving a simple chain-of-custody trail per package.
CREATE TABLE IF NOT EXISTS public.stop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_stop_id INTEGER NOT NULL REFERENCES public.route_stops(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  packed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stop_items_route_stop_id_idx ON public.stop_items (route_stop_id);
CREATE INDEX IF NOT EXISTS stop_items_barcode_idx ON public.stop_items (barcode);

-- Every scan that didn't match an expected item for that stop, at either
-- pickup or delivery. Recorded regardless of whether the driver chose to
-- proceed anyway, since scanning never blocks - this is purely so admins
-- can review how often (and where) mismatches are happening.
CREATE TABLE IF NOT EXISTS public.scan_mismatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_stop_id INTEGER NOT NULL REFERENCES public.route_stops(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('pickup', 'delivery')),
  scanned_barcode TEXT NOT NULL,
  driver_id UUID REFERENCES public.drivers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_mismatches_route_stop_id_idx ON public.scan_mismatches (route_stop_id);
CREATE INDEX IF NOT EXISTS scan_mismatches_created_at_idx ON public.scan_mismatches (created_at DESC);

-- All reads/writes to these two tables go through server actions using the
-- admin client with manual role checks (matching the pattern already used
-- for route requests, tracking, and series details), so RLS is enabled
-- with no permissive policies - nothing reaches these tables except through
-- those checked server actions.
ALTER TABLE public.stop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_mismatches ENABLE ROW LEVEL SECURITY;

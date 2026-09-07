ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS pay_route_type TEXT CHECK (pay_route_type IN ('4_hour', '6_hour') OR pay_route_type IS NULL),
  ADD COLUMN IF NOT EXISTS is_late_night BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_high_volume BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.route_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id),
  source_link TEXT,
  -- Draft stops parsed from a link or typed manually: [{ address, lat, lng }, ...]
  -- Not yet real route_stops rows - those only get created once an admin
  -- assigns a driver and this becomes an actual route.
  stops JSONB NOT NULL,
  is_emergency BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'dismissed')),
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.route_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_requests_select_own" ON public.route_requests
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.pharmacy_users pu
      WHERE pu.pharmacy_id = route_requests.pharmacy_id AND pu.id = auth.uid()
    )
  );

CREATE POLICY "route_requests_insert_own" ON public.route_requests
  FOR INSERT WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pharmacy_users pu
      WHERE pu.pharmacy_id = route_requests.pharmacy_id AND pu.id = auth.uid()
    )
  );

-- Only admins can assign/dismiss requests
CREATE POLICY "route_requests_update_admin" ON public.route_requests
  FOR UPDATE USING (public.is_admin());

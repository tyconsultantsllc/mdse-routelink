CREATE TABLE IF NOT EXISTS public.pharmacy_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES public.users(id),
  type TEXT NOT NULL CHECK (type IN ('problem', 'pickup_request', 'other')),
  message TEXT NOT NULL,
  route_stop_id UUID REFERENCES public.route_stops(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.pharmacy_reports ENABLE ROW LEVEL SECURITY;

-- A pharmacy account can see and create reports for their own pharmacy only
CREATE POLICY "pharmacy_reports_select_own" ON public.pharmacy_reports
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.pharmacy_users pu
      WHERE pu.pharmacy_id = pharmacy_reports.pharmacy_id AND pu.id = auth.uid()
    )
  );

CREATE POLICY "pharmacy_reports_insert_own" ON public.pharmacy_reports
  FOR INSERT WITH CHECK (
    reported_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pharmacy_users pu
      WHERE pu.pharmacy_id = pharmacy_reports.pharmacy_id AND pu.id = auth.uid()
    )
  );

-- Only admins can resolve/update reports
CREATE POLICY "pharmacy_reports_update_admin" ON public.pharmacy_reports
  FOR UPDATE USING (public.is_admin());

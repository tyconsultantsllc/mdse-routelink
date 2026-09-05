CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'admin', 'driver', 'pharmacy')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Everyone sees active, non-expired announcements targeted at their own
-- role (or 'all'). Admins additionally see everything regardless of
-- active/expired/audience status, since they need the full list to manage it.
CREATE POLICY "announcements_select_targeted" ON public.announcements
  FOR SELECT USING (
    public.is_admin()
    OR (
      is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (
        audience = 'all'
        OR audience = (SELECT role FROM public.users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "announcements_modify_admin" ON public.announcements
  FOR ALL USING (public.is_admin());

-- Lets drivers see their own timesheet and request corrections to it, with
-- every change needing admin sign-off before it counts - mirrors the
-- existing route_requests pattern (a request row admins approve/dismiss)
-- rather than letting drivers write hours directly.
--
-- NOTE: if you already ran a script named 031_driver_active_status.sql
-- (from an earlier delivery) in your Supabase project, rename this file to
-- 032_driver_timesheets.sql before running/committing it, so your scripts
-- stay in numeric order. The SQL itself is unaffected either way.

-- The admin-approved record of hours worked for one driver on one day.
-- Until an edit request is approved, the app computes a day's hours from
-- that driver's routes (actual_start_time/actual_end_time) instead of
-- reading from here - a row only exists once something's been corrected
-- and approved, or an admin sets it directly.
CREATE TABLE IF NOT EXISTS public.timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clock_in TIMESTAMP WITH TIME ZONE,
  clock_out TIMESTAMP WITH TIME ZONE,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  -- Every row today is 'manual' (came from an approved driver edit, or a
  -- direct admin correction) - 'auto' is reserved in case a background
  -- job ever starts persisting the computed-from-routes value here too.
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('auto', 'manual')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (driver_id, work_date)
);

CREATE INDEX IF NOT EXISTS timesheet_entries_driver_idx ON public.timesheet_entries(driver_id, work_date);

ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheet_entries_select_own" ON public.timesheet_entries
  FOR SELECT USING (public.is_admin() OR driver_id = auth.uid());

-- Drivers never write here directly - only an approved request (or an
-- admin's own direct edit) creates/updates a row, both via the
-- service-role client in app/actions/data-actions.ts. These policies just
-- make sure a regular signed-in client can't do it either.
CREATE POLICY "timesheet_entries_insert_admin" ON public.timesheet_entries
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "timesheet_entries_update_admin" ON public.timesheet_entries
  FOR UPDATE USING (public.is_admin());

-- A driver's request to change a day's timesheet. Stays 'pending' until an
-- admin approves (which writes/updates the matching timesheet_entries row)
-- or rejects it (which doesn't touch timesheet_entries at all).
CREATE TABLE IF NOT EXISTS public.timesheet_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  requested_clock_in TIMESTAMP WITH TIME ZONE,
  requested_clock_out TIMESTAMP WITH TIME ZONE,
  requested_break_minutes INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.users(id),
  review_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS timesheet_edit_requests_driver_idx ON public.timesheet_edit_requests(driver_id, work_date);
CREATE INDEX IF NOT EXISTS timesheet_edit_requests_status_idx ON public.timesheet_edit_requests(status, created_at);

ALTER TABLE public.timesheet_edit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheet_edit_requests_select_own" ON public.timesheet_edit_requests
  FOR SELECT USING (public.is_admin() OR driver_id = auth.uid());

CREATE POLICY "timesheet_edit_requests_insert_own" ON public.timesheet_edit_requests
  FOR INSERT WITH CHECK (driver_id = auth.uid());

-- Only admins can approve/reject
CREATE POLICY "timesheet_edit_requests_update_admin" ON public.timesheet_edit_requests
  FOR UPDATE USING (public.is_admin());

-- In-app + push notifications.
--
-- Replaces the earlier (never-shipped) plan of texting people via Twilio:
-- the same two events - a driver being assigned a route, and a pharmacy's
-- delivery being marked delivered/failed - now create a row here instead,
-- which (a) shows up in an in-app notification bell immediately, and (b)
-- triggers a real push notification to any of that user's registered
-- devices (see lib/push.ts and lib/use-push-registration.ts) so it's seen
-- even if they're not looking at the app right now.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'error')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  -- Optional links back to what this notification is about, for a future
  -- "tap to open" - not read anywhere yet, just recorded now while the
  -- context is on hand.
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  route_stop_id UUID REFERENCES public.route_stops(id) ON DELETE SET NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- A user only ever reads/updates their own notifications. All of the app's
-- own reads and writes actually go through server actions using the
-- service-role client (which bypasses RLS entirely, same as the rest of
-- app/actions/data-actions.ts) - these policies exist so that's still safe
-- if anything ever queries this table with a regular signed-in client.
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_admin" ON public.notifications
  FOR INSERT WITH CHECK (public.is_admin());

-- One row per device that has registered for push notifications. A device
-- can be re-used by a different login (logout, then a different user logs
-- in on the same phone), so token is unique and re-registering it just
-- moves it to whoever's logged in now, rather than erroring.
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'android',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_select_own" ON public.push_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "push_tokens_insert_own" ON public.push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_tokens_delete_own" ON public.push_tokens
  FOR DELETE USING (auth.uid() = user_id);

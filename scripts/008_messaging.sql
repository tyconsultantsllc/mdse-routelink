CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value)
VALUES ('driver_to_driver_messaging_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can read settings (the driver app needs to know
-- whether driver-to-driver messaging is currently turned on).
CREATE POLICY "app_settings_select_all" ON public.app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "app_settings_modify_admin" ON public.app_settings
  FOR ALL USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'dispatch': a driver talking to admin/dispatch as a whole (any admin
  -- can see and reply — this is a shared inbox, not a specific admin pairing).
  -- 'direct': exactly two drivers messaging each other one-on-one.
  type TEXT NOT NULL CHECK (type IN ('dispatch', 'direct')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- A dispatch conversation is visible to its driver participant AND to
-- every admin (a shared inbox), without needing every admin explicitly
-- listed as a participant. A direct conversation is visible only to its
-- two actual participants.
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING (
    (type = 'dispatch' AND public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "participants_select" ON public.conversation_participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id AND cp2.user_id = auth.uid()
    )
  );

CREATE POLICY "participants_insert" ON public.conversation_participants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        (c.type = 'dispatch' AND public.is_admin())
        OR EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = c.id AND cp.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        (c.type = 'dispatch' AND public.is_admin())
        OR EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = c.id AND cp.user_id = auth.uid()
        )
      )
    )
  );

-- Drivers can't see each other's user records at all otherwise (see
-- 005_scope_read_policies.sql). This opens visibility just enough for the
-- driver-to-driver messaging picker, and only while the admin toggle is
-- on — enforced here at the database level, not just hidden in the UI.
CREATE POLICY "users_select_drivers_for_messaging" ON public.users
  FOR SELECT USING (
    role = 'driver'
    AND EXISTS (SELECT 1 FROM public.drivers WHERE id = auth.uid())
    AND COALESCE((SELECT value::boolean FROM public.app_settings WHERE key = 'driver_to_driver_messaging_enabled'), false)
  );

-- conversation_participants' own SELECT policy queried conversation_participants
-- from within itself - Postgres flags this as infinite recursion outright,
-- regardless of whether it would actually loop forever. Same root cause as
-- the users_select_admin issue fixed in 006, same fix: a SECURITY DEFINER
-- function that bypasses RLS for the internal check.
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "participants_select" ON public.conversation_participants;
CREATE POLICY "participants_select" ON public.conversation_participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.is_conversation_participant(conversation_id)
  );

-- conversations_select wasn't self-referencing, but it queried
-- conversation_participants directly, which transitively triggered the
-- broken policy above on every conversation lookup, not just direct
-- conversation_participants queries.
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING (
    (type = 'dispatch' AND public.is_admin())
    OR public.is_conversation_participant(id)
  );

DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        (c.type = 'dispatch' AND public.is_admin())
        OR public.is_conversation_participant(c.id)
      )
    )
  );

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        (c.type = 'dispatch' AND public.is_admin())
        OR public.is_conversation_participant(c.id)
      )
    )
  );

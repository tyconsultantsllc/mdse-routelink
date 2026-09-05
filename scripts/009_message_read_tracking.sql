ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE;

-- Admins aren't listed as participants in dispatch conversations (any admin
-- can see any of them), so their own read state needs separate tracking
-- rather than reusing conversation_participants.
CREATE TABLE IF NOT EXISTS public.admin_message_reads (
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (admin_id, conversation_id)
);

ALTER TABLE public.admin_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_message_reads_own" ON public.admin_message_reads
  FOR ALL USING (admin_id = auth.uid() AND public.is_admin());

-- Fix: routes.status CHECK only allowed 'in_progress' (underscore), but every
-- frontend page (driver, admin, pharmacy, edit-route-modal) compares against
-- 'in-progress' (hyphen). Nothing in the app currently writes 'in_progress',
-- so this is safe to widen rather than risk a partial rename across files.
ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS routes_status_check;
ALTER TABLE public.routes ADD CONSTRAINT routes_status_check
  CHECK (status IN ('pending', 'in_progress', 'in-progress', 'completed', 'cancelled'));

-- Delivery confirmation: recipient name, signature, and photo evidence

ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS signature_path TEXT,
  ADD COLUMN IF NOT EXISTS photo_paths TEXT[] DEFAULT '{}';

-- Private bucket for signatures / delivery photos (not publicly readable)
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-of-delivery', 'proof-of-delivery', false)
ON CONFLICT (id) DO NOTHING;

-- Drivers can upload into their own folder: proof-of-delivery/{driver_id}/...
CREATE POLICY "pod_insert_own_folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'proof-of-delivery'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Drivers can read back their own uploads; admins can read all
CREATE POLICY "pod_select_own_or_admin" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'proof-of-delivery'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Run this in the Supabase SQL Editor after 001-003.
-- Note: signature_path / photo_paths store storage OBJECT PATHS, not public URLs,
-- since the bucket is private. Use supabase.storage.from('proof-of-delivery')
-- .createSignedUrl(path, expiresInSeconds) to display them (see lib/driver-actions.ts).

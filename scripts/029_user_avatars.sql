-- Real profile-photo support. Previously "Change Photo" on the admin
-- Settings page was a button with no onClick and no storage anywhere to
-- put an uploaded image - every avatar shown across the app (admin,
-- driver, pharmacy) is a DiceBear placeholder generated from the user's
-- id, not a real photo.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Public bucket: avatars are already shown to every role throughout the
-- app today (as the DiceBear placeholder), so there's no new exposure in
-- making the real photo a public, unsigned URL - simpler than issuing
-- signed URLs (which expire) for something this low-sensitivity.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- A user may only write to their own folder: avatars/{user_id}/...
CREATE POLICY "avatars_insert_own_folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_update_own_folder" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_delete_own_folder" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Run this in the Supabase SQL Editor after the earlier numbered scripts.
-- avatar_url stores a public URL (from supabase.storage.from('avatars')
-- .getPublicUrl(path)), not an object path, since the bucket is public.

-- Lets an admin deactivate a driver's account (blocks login, hides them from
-- future assignment) without deleting it - deleting a driver's account today
-- permanently erases their entire delivery_logs history (ON DELETE CASCADE),
-- which is the wrong tool for "this person no longer drives for us but we
-- still need their records." Defaults to true so every existing driver
-- stays exactly as usable as they are today.

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Routes created without a specific start time previously ended up with
-- start_time = NULL entirely, not just a missing time-of-day - which made
-- them invisible on both the admin and driver calendars, since both key
-- placement off start_time. The code that caused this is now fixed, but
-- existing rows already have this problem. created_at is the closest
-- available proxy for when each of these was actually meant to run.
UPDATE public.routes
SET start_time = created_at
WHERE start_time IS NULL;

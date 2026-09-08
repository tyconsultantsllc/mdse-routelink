ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS region TEXT CHECK (region IN ('socal', 'minnesota') OR region IS NULL);

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS region TEXT CHECK (region IN ('socal', 'minnesota') OR region IS NULL);

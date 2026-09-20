ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS return_signature_mode TEXT NOT NULL DEFAULT 'batch'
    CHECK (return_signature_mode IN ('batch', 'per_item'));

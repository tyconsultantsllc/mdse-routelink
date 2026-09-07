CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Separate from public.users deliberately - this table is never touched by
-- getUsers() or any general query, and RLS restricts it to admins only.
CREATE TABLE IF NOT EXISTS public.driver_payroll_info (
  driver_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  address TEXT,
  ssn_last4_encrypted BYTEA,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.driver_payroll_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_payroll_info_admin_only" ON public.driver_payroll_info
  FOR ALL USING (public.is_admin());

-- Upsert that encrypts the SSN before it's ever written. Re-saving just the
-- address (no new SSN provided) preserves whatever SSN was already stored,
-- rather than wiping it - the encryption key never touches the client, it's
-- passed in per-call from a server-only environment variable.
CREATE OR REPLACE FUNCTION public.save_driver_payroll_info(
  p_driver_id UUID,
  p_address TEXT,
  p_ssn_last4 TEXT,
  p_encryption_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Admin access required';
  END IF;

  INSERT INTO public.driver_payroll_info (driver_id, address, ssn_last4_encrypted, updated_at)
  VALUES (
    p_driver_id,
    p_address,
    CASE WHEN p_ssn_last4 IS NOT NULL AND p_ssn_last4 != '' THEN pgp_sym_encrypt(p_ssn_last4, p_encryption_key) ELSE NULL END,
    NOW()
  )
  ON CONFLICT (driver_id) DO UPDATE SET
    address = EXCLUDED.address,
    ssn_last4_encrypted = COALESCE(EXCLUDED.ssn_last4_encrypted, public.driver_payroll_info.ssn_last4_encrypted),
    updated_at = NOW();
END;
$$;

-- Decrypts only at the moment of retrieval, only for an admin, only for
-- generating that driver's paystub - never returned as part of any broader
-- driver listing.
CREATE OR REPLACE FUNCTION public.get_driver_payroll_info(
  p_driver_id UUID,
  p_encryption_key TEXT
)
RETURNS TABLE (address TEXT, ssn_last4 TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    dpi.address,
    CASE WHEN dpi.ssn_last4_encrypted IS NOT NULL THEN pgp_sym_decrypt(dpi.ssn_last4_encrypted, p_encryption_key) ELSE NULL END
  FROM public.driver_payroll_info dpi
  WHERE dpi.driver_id = p_driver_id;
END;
$$;

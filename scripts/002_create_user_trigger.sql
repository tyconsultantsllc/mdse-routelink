-- Trigger to auto-create user profile on signup

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, first_name, last_name, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'driver'),
    COALESCE(new.raw_user_meta_data->>'first_name', NULL),
    COALESCE(new.raw_user_meta_data->>'last_name', NULL),
    COALESCE(new.raw_user_meta_data->>'phone', NULL)
  )
  ON CONFLICT (id) DO NOTHING;

  -- If role is driver, create driver record
  IF COALESCE(new.raw_user_meta_data->>'role', 'driver') = 'driver' THEN
    INSERT INTO public.drivers (id, vehicle_type, vehicle_plate, license_number)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'vehicle_type', NULL),
      COALESCE(new.raw_user_meta_data->>'vehicle_plate', NULL),
      COALESCE(new.raw_user_meta_data->>'license_number', NULL)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- If role is pharmacy, create pharmacy user record
  IF COALESCE(new.raw_user_meta_data->>'role', 'driver') = 'pharmacy' THEN
    INSERT INTO public.pharmacy_users (id, pharmacy_id)
    VALUES (
      new.id,
      (new.raw_user_meta_data->>'pharmacy_id')::UUID
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

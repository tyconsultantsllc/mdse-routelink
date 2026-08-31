-- PharmaTrack Express Database Schema

-- Users table (extends auth.users with role information)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'driver', 'pharmacy')),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own data
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own data
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Allow admins to view all users
CREATE POLICY "users_select_admin" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Pharmacies table
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view pharmacies
CREATE POLICY "pharmacies_select_all" ON public.pharmacies
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can insert/update/delete pharmacies
CREATE POLICY "pharmacies_modify_admin" ON public.pharmacies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Drivers table (extends users with driver-specific info)
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_type TEXT,
  vehicle_plate TEXT,
  license_number TEXT,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'on_break', 'offline')),
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  last_location_update TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own data
CREATE POLICY "drivers_select_own" ON public.drivers
  FOR SELECT USING (auth.uid() = id);

-- Drivers can update their own data
CREATE POLICY "drivers_update_own" ON public.drivers
  FOR UPDATE USING (auth.uid() = id);

-- Admins can view all drivers
CREATE POLICY "drivers_select_admin" ON public.drivers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can modify drivers
CREATE POLICY "drivers_modify_admin" ON public.drivers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Routes table
CREATE TABLE IF NOT EXISTS public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  estimated_duration INTEGER, -- in minutes
  actual_start_time TIMESTAMP WITH TIME ZONE,
  actual_end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view routes
CREATE POLICY "routes_select_all" ON public.routes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admins can modify routes
CREATE POLICY "routes_modify_admin" ON public.routes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Drivers can update their assigned routes (status, actual times)
CREATE POLICY "routes_update_driver" ON public.routes
  FOR UPDATE USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE id = auth.uid()
    )
  );

-- Route Stops table (pharmacy stops within a route)
CREATE TABLE IF NOT EXISTS public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  pickup_latitude DECIMAL(10, 8),
  pickup_longitude DECIMAL(11, 8),
  dropoff_latitude DECIMAL(10, 8),
  dropoff_longitude DECIMAL(11, 8),
  estimated_time INTEGER, -- in minutes
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'picked_up', 'delivered', 'failed')),
  actual_pickup_time TIMESTAMP WITH TIME ZONE,
  actual_delivery_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view route stops
CREATE POLICY "route_stops_select_all" ON public.route_stops
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admins can modify route stops
CREATE POLICY "route_stops_modify_admin" ON public.route_stops
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Drivers can update stops on their assigned routes
CREATE POLICY "route_stops_update_driver" ON public.route_stops
  FOR UPDATE USING (
    route_id IN (
      SELECT id FROM public.routes
      WHERE driver_id IN (SELECT id FROM public.drivers WHERE id = auth.uid())
    )
  );

-- Pharmacy Users table (links pharmacies to user accounts)
CREATE TABLE IF NOT EXISTS public.pharmacy_users (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  notifications_email BOOLEAN DEFAULT true,
  notifications_sms BOOLEAN DEFAULT false,
  notify_on_delivery BOOLEAN DEFAULT true,
  notify_on_enroute BOOLEAN DEFAULT true,
  notify_on_delay BOOLEAN DEFAULT true,
  notify_on_new_route BOOLEAN DEFAULT false
);

ALTER TABLE public.pharmacy_users ENABLE ROW LEVEL SECURITY;

-- Pharmacy users can view their own data
CREATE POLICY "pharmacy_users_select_own" ON public.pharmacy_users
  FOR SELECT USING (auth.uid() = id);

-- Pharmacy users can update their own data
CREATE POLICY "pharmacy_users_update_own" ON public.pharmacy_users
  FOR UPDATE USING (auth.uid() = id);

-- Admins can view all pharmacy users
CREATE POLICY "pharmacy_users_select_admin" ON public.pharmacy_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Delivery Logs table
CREATE TABLE IF NOT EXISTS public.delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  route_stop_id UUID REFERENCES public.route_stops(id) ON DELETE SET NULL,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  notes TEXT
);

ALTER TABLE public.delivery_logs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view delivery logs
CREATE POLICY "delivery_logs_select_all" ON public.delivery_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Drivers and admins can insert delivery logs
CREATE POLICY "delivery_logs_insert_driver_admin" ON public.delivery_logs
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM public.drivers) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_routes_driver_id ON public.routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON public.routes(status);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON public.route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_pharmacy_id ON public.route_stops(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_route_id ON public.delivery_logs(route_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_driver_id ON public.delivery_logs(driver_id);

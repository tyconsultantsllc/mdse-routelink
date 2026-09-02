'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  })
}

async function verifyAuth() {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new Error('Unauthorized: You must be logged in')
  }

  // Get user role from database
  const adminClient = createAdminClient()
  const { data: userData, error: userError } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userError || !userData) {
    throw new Error('Unauthorized: User not found')
  }

  return { userId: user.id, role: userData.role }
}

export async function getUsers() {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

export async function getDrivers() {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
  
  if (error) throw error
  return data
}

export async function getPharmacies() {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('pharmacies')
    .select('*')
  
  if (error) throw error
  return data
}

export async function getRoutes() {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

export async function getDeliveryLogs(limit = 500) {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('delivery_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data
}

export async function getDriverRoute() {
  const { userId, role } = await verifyAuth()
  
  if (role !== 'driver') {
    throw new Error('Forbidden: Driver access required')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('driver_id', userId)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function createUser(input: {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  role: 'admin' | 'driver' | 'pharmacy'
  vehicleType?: string
  vehiclePlate?: string
  licenseNumber?: string
  pharmacyId?: string
}) {
  const { role: callerRole } = await verifyAuth()

  if (callerRole !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()

  // Using the admin API rather than supabase.auth.signUp() is essential here:
  // signUp() establishes a session for whoever it creates, which would replace
  // the calling admin's own session in their browser. The admin API creates
  // the account without touching any existing session, and email_confirm:true
  // skips the confirmation-email step, appropriate for accounts an admin is
  // provisioning directly rather than public self-signup.
  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: input.role,
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      vehicle_type: input.vehicleType,
      vehicle_plate: input.vehiclePlate,
      license_number: input.licenseNumber,
      pharmacy_id: input.pharmacyId,
    },
  })

  if (error) throw error

  return data.user
}

export async function deleteUser(userId: string) {
  const { role, userId: callerId } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  if (userId === callerId) {
    throw new Error('You cannot delete your own account')
  }

  // Same reason as createUser: auth.admin methods require the service-role
  // client. The anon client this was previously called from has no
  // permission to do this and would always fail.
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)

  if (error) throw error
}

export async function updateUser(userId: string, updates: {
  firstName?: string
  lastName?: string
  phone?: string
  vehicleType?: string
  vehiclePlate?: string
  licenseNumber?: string
  role?: string
}) {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()

  // Update users table
  const { error: userError } = await supabase
    .from('users')
    .update({
      first_name: updates.firstName,
      last_name: updates.lastName,
      phone: updates.phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (userError) throw userError

  // Update drivers table if driver-specific fields are provided
  if (updates.vehicleType || updates.vehiclePlate || updates.licenseNumber) {
    const { error: driverError } = await supabase
      .from('drivers')
      .update({
        vehicle_type: updates.vehicleType,
        vehicle_plate: updates.vehiclePlate,
        license_number: updates.licenseNumber,
      })
      .eq('id', userId)

    if (driverError) throw driverError
  }

  return { success: true }
}

export async function getRouteStops() {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('route_stops')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export async function getDashboardStats() {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  
  // Get all data in parallel
  // NOTE: delivery_logs is capped at 1000 rows (most recent first) to avoid
  // pulling the entire history on every dashboard load. app/admin/reports/page.tsx
  // uses this same `logs` array for per-driver delivery counts, so on an
  // account with >1000 total deliveries those counts will undercount older
  // activity. A proper fix moves that aggregation into a SQL query
  // (e.g. count(*) grouped by driver_id, or a date-range filter) instead of
  // fetching every row to count client-side — worth doing before that page
  // is relied on for real reporting.
  const [routesResult, driversResult, logsResult] = await Promise.all([
    supabase.from('routes').select('*'),
    supabase.from('drivers').select('*'),
    supabase.from('delivery_logs').select('*').order('timestamp', { ascending: false }).limit(1000)
  ])

  if (routesResult.error) throw routesResult.error
  if (driversResult.error) throw driversResult.error
  if (logsResult.error) throw logsResult.error

  return {
    routes: routesResult.data || [],
    drivers: driversResult.data || [],
    logs: logsResult.data || []
  }
}

export async function createRoute(routeData: {
  name: string
  startTime?: string
  priority: string
  stops: Array<{
    pharmacyId: string
    pickupAddress: string
    dropoffAddress: string
    sequence: number
  }>
}) {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  
  let startTimeTimestamp = null
  if (routeData.startTime) {
    const today = new Date()
    const [hours, minutes] = routeData.startTime.split(':')
    today.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    startTimeTimestamp = today.toISOString()
  }
  
  // Insert the route
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .insert({
      name: routeData.name,
      start_time: startTimeTimestamp,
      priority: routeData.priority,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (routeError) {
    throw routeError
  }

  const stopsToInsert = routeData.stops.map(stop => ({
    route_id: route.id,
    pharmacy_id: stop.pharmacyId,
    pickup_address: stop.pickupAddress,
    dropoff_address: stop.dropoffAddress,
    stop_order: stop.sequence,
    status: 'pending',
  }))

  const { error: stopsError } = await supabase
    .from('route_stops')
    .insert(stopsToInsert)

  if (stopsError) {
    throw stopsError
  }

  return route
}

export async function assignDriverToRoute(routeId: number, driverId: string) {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  
  const { error } = await supabase
    .from('routes')
    .update({
      driver_id: driverId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routeId)

  if (error) throw error
  
  return { success: true }
}

export async function getRouteById(routeId: number) {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  
  // Get route data
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .select('*')
    .eq('id', routeId)
    .single()

  if (routeError) throw routeError

  // Get route stops
  const { data: stops, error: stopsError } = await supabase
    .from('route_stops')
    .select('*, pharmacies(name, address)')
    .eq('route_id', routeId)
    .order('stop_order', { ascending: true })

  if (stopsError) throw stopsError

  return {
    ...route,
    stops: stops?.map(stop => ({
      id: stop.id,
      pharmacy_id: stop.pharmacy_id,
      pharmacy_name: stop.pharmacies?.name,
      pickup_address: stop.pickup_address,
      dropoff_address: stop.dropoff_address,
      stop_order: stop.stop_order,
    })) || []
  }
}

export async function updateRoute(routeId: number, routeData: {
  name: string
  startTime?: string
  priority: string
  status: string
  stops: Array<{
    id?: string
    pharmacyId: string
    pickupAddress: string
    dropoffAddress: string
    stopOrder: number
  }>
}) {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  
  let startTimeTimestamp = null
  if (routeData.startTime) {
    const today = new Date()
    const [hours, minutes] = routeData.startTime.split(':')
    today.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    startTimeTimestamp = today.toISOString()
  }
  
  // Update the route
  const { error: routeError } = await supabase
    .from('routes')
    .update({
      name: routeData.name,
      start_time: startTimeTimestamp,
      priority: routeData.priority,
      status: routeData.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routeId)

  if (routeError) throw routeError

  // Delete existing stops
  const { error: deleteError } = await supabase
    .from('route_stops')
    .delete()
    .eq('route_id', routeId)

  if (deleteError) throw deleteError

  // Insert updated stops
  const stopsToInsert = routeData.stops.map(stop => ({
    route_id: routeId,
    pharmacy_id: stop.pharmacyId,
    pickup_address: stop.pickupAddress,
    dropoff_address: stop.dropoffAddress,
    stop_order: stop.stopOrder,
    status: 'pending',
  }))

  const { error: stopsError } = await supabase
    .from('route_stops')
    .insert(stopsToInsert)

  if (stopsError) throw stopsError

  return { success: true }
}

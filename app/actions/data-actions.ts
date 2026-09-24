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
    .select('*, drivers(*)')
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
    .select('*, route_stops(*, pharmacies(name, address, latitude, longitude, region))')
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
    .select('*, routes(name, priority), route_stops(dropoff_address, recipient_name, signature_path, status, return_confirmed_by, return_signature_path, return_confirmed_at)')
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
  region?: string
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
      region: input.region,
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

export async function adminUpdateUserEmail(userId: string, newEmail: string) {
  const { role } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()

  // Uses the Auth Admin API (service role) rather than the self-service
  // auth.updateUser() flow, since an admin changing someone else's email
  // isn't operating in that user's own session. email_confirm:true applies
  // it immediately rather than requiring a confirmation link - appropriate
  // here since this is a trusted admin action, e.g. fixing a typo or
  // helping someone who's lost access to their old email, not a
  // self-service change that needs protection against hijacking.
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true,
  })

  if (error) throw error

  // The trigger in 014_sync_email_updates.sql keeps public.users.email in
  // sync automatically, but update it here too in case that migration
  // hasn't been run yet on this database.
  await supabase.from('users').update({ email: newEmail }).eq('id', userId)
}

export async function getPharmacyReturnSignatureMode(pharmacyId: string): Promise<'batch' | 'per_item'> {
  await verifyAuth()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('pharmacies')
    .select('return_signature_mode')
    .eq('id', pharmacyId)
    .single()

  if (error) throw error
  return data?.return_signature_mode || 'batch'
}

export async function updateOwnPharmacyReturnSignatureMode(mode: 'batch' | 'per_item') {
  const { userId, role } = await verifyAuth()

  if (role !== 'pharmacy') {
    throw new Error('Forbidden: pharmacy account required')
  }

  const supabase = createAdminClient()

  const { data: pharmacyUser, error: lookupError } = await supabase
    .from('pharmacy_users')
    .select('pharmacy_id')
    .eq('id', userId)
    .single()

  if (lookupError) throw lookupError
  if (!pharmacyUser?.pharmacy_id) throw new Error('No pharmacy is linked to this account')

  const { data, error } = await supabase
    .from('pharmacies')
    .update({ return_signature_mode: mode })
    .eq('id', pharmacyUser.pharmacy_id)
    .select()

  if (error) throw error
  if (!data || data.length === 0) throw new Error('Update did not match any pharmacy record')

  return { success: true }
}

export async function getOwnPharmacyReturnSignatureMode() {
  const { userId, role } = await verifyAuth()

  if (role !== 'pharmacy') {
    throw new Error('Forbidden: pharmacy account required')
  }

  const supabase = createAdminClient()

  const { data: pharmacyUser, error: lookupError } = await supabase
    .from('pharmacy_users')
    .select('pharmacy_id, pharmacies(return_signature_mode)')
    .eq('id', userId)
    .single()

  if (lookupError) throw lookupError

  const pharmacyRow = Array.isArray(pharmacyUser?.pharmacies) ? pharmacyUser.pharmacies[0] : pharmacyUser?.pharmacies
  return pharmacyRow?.return_signature_mode || 'batch'
}

export async function getOwnPharmacyTrackingEnabled() {
  const { userId, role } = await verifyAuth()

  if (role !== 'pharmacy') {
    throw new Error('Forbidden: pharmacy account required')
  }

  const supabase = createAdminClient()

  const { data: pharmacyUser, error: lookupError } = await supabase
    .from('pharmacy_users')
    .select('pharmacy_id, pharmacies(customer_tracking_enabled)')
    .eq('id', userId)
    .single()

  if (lookupError) throw lookupError

  const pharmacyRow = Array.isArray(pharmacyUser?.pharmacies) ? pharmacyUser.pharmacies[0] : pharmacyUser?.pharmacies
  return !!pharmacyRow?.customer_tracking_enabled
}

export async function updateOwnPharmacyTrackingEnabled(enabled: boolean) {
  const { userId, role } = await verifyAuth()

  if (role !== 'pharmacy') {
    throw new Error('Forbidden: pharmacy account required')
  }

  const supabase = createAdminClient()

  const { data: pharmacyUser, error: lookupError } = await supabase
    .from('pharmacy_users')
    .select('pharmacy_id')
    .eq('id', userId)
    .single()

  if (lookupError) throw lookupError
  if (!pharmacyUser?.pharmacy_id) throw new Error('No pharmacy is linked to this account')

  const { data, error } = await supabase
    .from('pharmacies')
    .update({ customer_tracking_enabled: enabled })
    .eq('id', pharmacyUser.pharmacy_id)
    .select()

  if (error) throw error
  if (!data || data.length === 0) throw new Error('Update did not match any pharmacy record')

  return { success: true }
}

export async function updateOwnProfile(updates: {
  firstName?: string
  lastName?: string
  phone?: string
  vehicleType?: string
  vehiclePlate?: string
  licenseNumber?: string
}) {
  const { userId, role } = await verifyAuth()

  const supabase = createAdminClient()

  const userUpdates: Record<string, any> = {}
  if (updates.firstName !== undefined) userUpdates.first_name = updates.firstName
  if (updates.lastName !== undefined) userUpdates.last_name = updates.lastName
  if (updates.phone !== undefined) userUpdates.phone = updates.phone

  if (Object.keys(userUpdates).length > 0) {
    const { error } = await supabase.from('users').update(userUpdates).eq('id', userId)
    if (error) throw error
  }

  if (role === 'driver') {
    const driverUpdates: Record<string, any> = {}
    if (updates.vehicleType !== undefined) driverUpdates.vehicle_type = updates.vehicleType
    if (updates.vehiclePlate !== undefined) driverUpdates.vehicle_plate = updates.vehiclePlate
    if (updates.licenseNumber !== undefined) driverUpdates.license_number = updates.licenseNumber

    if (Object.keys(driverUpdates).length > 0) {
      const { data, error } = await supabase.from('drivers').update(driverUpdates).eq('id', userId).select()
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('No driver record found for your account - the update matched zero rows.')
      }
    }
  }

  return { success: true }
}

export async function updateUser(userId: string, updates: {
  firstName?: string
  lastName?: string
  phone?: string
  vehicleType?: string
  vehiclePlate?: string
  licenseNumber?: string
  role?: string
  region?: string
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
  if (updates.vehicleType || updates.vehiclePlate || updates.licenseNumber || updates.region) {
    const { data: driverData, error: driverError } = await supabase
      .from('drivers')
      .update({
        vehicle_type: updates.vehicleType,
        vehicle_plate: updates.vehiclePlate,
        license_number: updates.licenseNumber,
        region: updates.region,
      })
      .eq('id', userId)
      .select()

    if (driverError) throw driverError

    console.log(`[diagnostic] updateUser driver write for ${userId}:`, JSON.stringify(driverData))

    // Supabase reports success even when zero rows matched the filter -
    // that's not an error, just nothing to update, which silently produces
    // "it said it worked but nothing changed" if this driver has no row in
    // the drivers table at all.
    if (!driverData || driverData.length === 0) {
      throw new Error(`No driver record found for this user (id: ${userId}) - the update matched zero rows.`)
    }
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
    supabase.from('routes').select('*, route_stops(*, pharmacies(name, address, latitude, longitude, region))'),
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

interface RouteInsertData {
  name: string
  startDate?: string
  startTime?: string
  estimatedDuration?: number
  priority: string
  driverId?: string | null
  seriesId?: string | null
  stops: Array<{
    pharmacyId: string
    pickupAddress: string
    dropoffAddress: string
    sequence: number
    dropoffLatitude?: number | null
    dropoffLongitude?: number | null
  }>
}

/**
 * Inserts one route and its stops. Shared by createRoute (a single route)
 * and the series generator (called once per matching date) so both paths
 * stay identical rather than drifting apart over time.
 */
async function insertRouteWithStops(supabase: ReturnType<typeof createAdminClient>, routeData: RouteInsertData) {
  const baseDate = routeData.startDate ? new Date(`${routeData.startDate}T00:00:00`) : new Date()

  const buildTimestamp = (timeStr?: string) => {
    if (!timeStr) return null
    const d = new Date(baseDate)
    const [hours, minutes] = timeStr.split(':')
    d.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    return d.toISOString()
  }

  // start_time is the only field either calendar (admin or driver) uses to
  // place a route on a given day. Previously, no time-of-day meant no
  // start_time at all - which meant no date at all - which made the route
  // invisible on both calendars even though it was scheduled for a real
  // day. It now always carries at least the date, defaulting the
  // time-of-day to midnight when none was given.
  const startTimeTimestamp = buildTimestamp(routeData.startTime) || baseDate.toISOString()
  // No manual end time anymore - it's derived from the estimated duration so
  // it stays accurate automatically instead of requiring separate entry.
  const endTimeTimestamp = routeData.estimatedDuration
    ? new Date(new Date(startTimeTimestamp).getTime() + routeData.estimatedDuration * 60000).toISOString()
    : null

  const { data: route, error: routeError } = await supabase
    .from('routes')
    .insert({
      name: routeData.name,
      start_time: startTimeTimestamp,
      end_time: endTimeTimestamp,
      estimated_duration: routeData.estimatedDuration || null,
      priority: routeData.priority,
      driver_id: routeData.driverId || null,
      series_id: routeData.seriesId || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (routeError) throw routeError

  const stopsToInsert = routeData.stops.map(stop => ({
    route_id: route.id,
    pharmacy_id: stop.pharmacyId,
    pickup_address: stop.pickupAddress,
    dropoff_address: stop.dropoffAddress,
    dropoff_latitude: stop.dropoffLatitude ?? null,
    dropoff_longitude: stop.dropoffLongitude ?? null,
    stop_order: stop.sequence,
    status: 'pending',
  }))

  const { error: stopsError } = await supabase.from('route_stops').insert(stopsToInsert)
  if (stopsError) throw stopsError

  return route
}

export async function createRoute(routeData: {
  name: string
  startDate?: string
  startTime?: string
  estimatedDuration?: number
  priority: string
  stops: Array<{
    pharmacyId: string
    pickupAddress: string
    dropoffAddress: string
    sequence: number
    dropoffLatitude?: number | null
    dropoffLongitude?: number | null
  }>
}) {
  const { role } = await verifyAuth()
  
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()

  // startDate defaults to today only for backward compatibility with
  // callers that don't pass one - previously this ALWAYS used today
  // regardless of what date was intended, which silently broke scheduling
  // a route for any date other than today (the whole point of the calendar).
  return insertRouteWithStops(supabase, routeData)
}

/**
 * Creates a recurring route series and generates one real route occurrence
 * for every date in [seriesStartDate, seriesEndDate] whose day of week is
 * in daysOfWeek. Each occurrence is a fully independent route with its own
 * stops - editing or working one never touches the others.
 */
export async function createRouteSeries(input: {
  name: string
  driverId?: string | null
  priority: string
  startTime?: string
  estimatedDuration?: number
  daysOfWeek: number[]
  seriesStartDate: string
  seriesEndDate?: string
  stops: Array<{
    pharmacyId: string
    pickupAddress: string
    dropoffAddress: string
    sequence: number
    dropoffLatitude?: number | null
    dropoffLongitude?: number | null
  }>
  confirmDespiteConflicts?: boolean
}) {
  const { role } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  if (input.daysOfWeek.length === 0) throw new Error('Select at least one day of the week')

  const start = new Date(`${input.seriesStartDate}T00:00:00`)
  // No truly indefinite option - an end date left blank defaults to 3
  // months out rather than requiring the admin to pick an exact date.
  const effectiveEndDate =
    input.seriesEndDate ||
    (() => {
      const d = new Date(start)
      d.setMonth(d.getMonth() + 3)
      return d.toISOString().split('T')[0]
    })()
  const end = new Date(`${effectiveEndDate}T00:00:00`)
  if (end < start) throw new Error('End date must be on or after the start date')

  const occurrenceDates: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (input.daysOfWeek.includes(d.getDay())) {
      occurrenceDates.push(d.toISOString().split('T')[0])
    }
  }

  if (occurrenceDates.length === 0) {
    throw new Error('No dates in that range match the selected days of the week')
  }

  // Check every occurrence for a conflict before creating anything, so a
  // cancelled warning doesn't leave a half-created series behind.
  if (input.driverId && !input.confirmDespiteConflicts) {
    const buildOccurrenceTimestamp = (dateStr: string, timeStr?: string) => {
      const d = new Date(`${dateStr}T00:00:00`)
      if (timeStr) {
        const [h, m] = timeStr.split(':')
        d.setHours(parseInt(h), parseInt(m), 0, 0)
      }
      return d.toISOString()
    }
    const ranges = occurrenceDates.map((date) => {
      const rangeStart = buildOccurrenceTimestamp(date, input.startTime)
      return {
        start: rangeStart,
        end: input.estimatedDuration
          ? new Date(new Date(rangeStart).getTime() + input.estimatedDuration * 60000).toISOString()
          : undefined,
        label: date,
      }
    })
    const conflicts = await checkDriverConflicts(input.driverId, ranges)
    if (conflicts.length > 0) {
      return { conflicts, series: null, routes: [] }
    }
  }

  const supabase = createAdminClient()

  const { data: series, error: seriesError } = await supabase
    .from('route_series')
    .insert({
      name: input.name,
      driver_id: input.driverId || null,
      priority: input.priority,
      start_time_of_day: input.startTime || null,
      estimated_duration: input.estimatedDuration || null,
      days_of_week: input.daysOfWeek,
      series_start_date: input.seriesStartDate,
      series_end_date: effectiveEndDate,
      stops_template: input.stops,
    })
    .select()
    .single()

  if (seriesError) throw seriesError

  const routes = []
  for (const date of occurrenceDates) {
    const route = await insertRouteWithStops(supabase, {
      name: input.name,
      startDate: date,
      startTime: input.startTime,
      estimatedDuration: input.estimatedDuration,
      priority: input.priority,
      driverId: input.driverId,
      seriesId: series.id,
      stops: input.stops,
    })
    routes.push(route)
  }

  return { series, routes, conflicts: [] as any[] }
}

/**
 * Checks whether a driver already has other routes overlapping any of the
 * given time ranges. Used before assigning a driver (single route, a route
 * request, or every occurrence of a new series) so a conflict is caught
 * before it's created rather than discovered after the fact.
 *
 * Routes with no end_time are treated as a 4-hour block for the purposes
 * of this comparison only - it doesn't change any stored data, just gives
 * the overlap check something concrete to compare against.
 */
export async function checkDriverConflicts(
  driverId: string,
  ranges: Array<{ start: string; end?: string | null; label: string }>,
  excludeRouteId?: number,
) {
  const { role } = await verifyAuth()
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }
  if (!driverId || ranges.length === 0) return []

  const supabase = createAdminClient()

  const { data: existingRoutes, error } = await supabase
    .from('routes')
    .select('id, name, start_time, end_time, status')
    .eq('driver_id', driverId)
    .neq('status', 'completed')

  if (error) throw error

  const DEFAULT_BLOCK_MS = 4 * 60 * 60 * 1000

  const asWindow = (start: string, end?: string | null) => {
    const startMs = new Date(start).getTime()
    const endMs = end ? new Date(end).getTime() : startMs + DEFAULT_BLOCK_MS
    return { startMs, endMs: endMs > startMs ? endMs : startMs + DEFAULT_BLOCK_MS }
  }

  const conflicts: Array<{ label: string; conflictsWith: Array<{ id: number; name: string }> }> = []

  for (const range of ranges) {
    const candidate = asWindow(range.start, range.end)
    const matches = (existingRoutes || [])
      .filter((r) => r.id !== excludeRouteId && r.start_time)
      .filter((r) => {
        const existing = asWindow(r.start_time, r.end_time)
        return candidate.startMs < existing.endMs && existing.startMs < candidate.endMs
      })

    if (matches.length > 0) {
      conflicts.push({
        label: range.label,
        conflictsWith: matches.map((m) => ({ id: m.id, name: m.name })),
      })
    }
  }

  return conflicts
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
      driver_confirmation: 'pending',
      declined_reason: null,
      confirmation_resolved_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routeId)

  if (error) throw error
  
  return { success: true }
}

export async function getRouteSeriesDetails(seriesId: string) {
  const { role } = await verifyAuth()
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()

  const { data: series, error: seriesError } = await supabase
    .from('route_series')
    .select('*, drivers(id, users(first_name, last_name))')
    .eq('id', seriesId)
    .single()

  if (seriesError) throw seriesError

  const { data: occurrences, error: occurrencesError } = await supabase
    .from('routes')
    .select('id, name, start_time, end_time, status, driver_confirmation, declined_reason, route_stops(id, status)')
    .eq('series_id', seriesId)
    .order('start_time', { ascending: true })

  if (occurrencesError) throw occurrencesError

  const driverInfo: any = Array.isArray((series as any).drivers) ? (series as any).drivers[0] : (series as any).drivers
  const userInfo: any = Array.isArray(driverInfo?.users) ? driverInfo.users[0] : driverInfo?.users
  const driverName = userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : "Unassigned"

  return {
    series: {
      id: series.id,
      name: series.name,
      driverName,
      priority: series.priority,
      daysOfWeek: series.days_of_week as number[],
      seriesStartDate: series.series_start_date,
      seriesEndDate: series.series_end_date,
      startTimeOfDay: series.start_time_of_day,
      endTimeOfDay: series.end_time_of_day,
      stopCount: (series.stops_template as any[])?.length || 0,
    },
    occurrences: (occurrences || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      startTime: o.start_time,
      status: o.status,
      driverConfirmation: o.driver_confirmation,
      declinedReason: o.declined_reason,
      stopCount: (o.route_stops || []).length,
    })),
  }
}

/**
 * Public, unauthenticated lookup for the customer-facing tracking page.
 * Deliberately does NOT call verifyAuth() - this is meant to be reachable
 * by anyone holding the tracking link, no login involved. To keep that
 * safe, it uses the admin client but hand-picks only non-identifying
 * fields to return: no recipient name, no exact address, no notes, no
 * other stops' details beyond a plain count. A stop can only ever be
 * looked up by its own random tracking_code - there is no way to list or
 * enumerate deliveries through this action.
 */
export async function getPublicTrackingInfo(trackingCode: string) {
  const supabase = createAdminClient()

  const { data: stop, error: stopError } = await supabase
    .from('route_stops')
    .select('id, route_id, status, stop_order, pharmacy_id, actual_pickup_time, actual_delivery_time')
    .eq('tracking_code', trackingCode)
    .maybeSingle()

  if (stopError) throw stopError
  if (!stop) return null

  const { data: pharmacy } = await supabase
    .from('pharmacies')
    .select('name, customer_tracking_enabled')
    .eq('id', stop.pharmacy_id)
    .single()

  // Respect the pharmacy's current setting even for a link generated
  // earlier - if they've since turned tracking off, the link stops working.
  if (!pharmacy?.customer_tracking_enabled) return null

  const { data: route } = await supabase
    .from('routes')
    .select('status, driver_id')
    .eq('id', stop.route_id)
    .single()

  let driverFirstName: string | null = null
  let driverLocation: { latitude: number; longitude: number; updatedAt: string } | null = null

  if (route?.driver_id) {
    const { data: driver } = await supabase
      .from('drivers')
      .select('current_latitude, current_longitude, last_location_update, users(first_name)')
      .eq('id', route.driver_id)
      .single()

    const userInfo: any = Array.isArray((driver as any)?.users) ? (driver as any).users[0] : (driver as any)?.users
    driverFirstName = userInfo?.first_name || null

    // Only surface a live position while this specific stop is the one
    // actively being driven to - not for the whole route's duration.
    if (stop.status === 'picked_up' && driver?.current_latitude && driver?.current_longitude) {
      driverLocation = {
        latitude: driver.current_latitude,
        longitude: driver.current_longitude,
        updatedAt: driver.last_location_update,
      }
    }
  }

  const { count: stopsAhead } = await supabase
    .from('route_stops')
    .select('id', { count: 'exact', head: true })
    .eq('route_id', stop.route_id)
    .lt('stop_order', stop.stop_order)
    .in('status', ['pending', 'picked_up'])

  return {
    pharmacyName: pharmacy.name,
    status: stop.status as 'pending' | 'picked_up' | 'delivered' | 'failed' | 'returned',
    routeStatus: route?.status || 'pending',
    stopsAhead: stopsAhead || 0,
    driverFirstName,
    driverLocation,
    deliveredAt: stop.actual_delivery_time,
  }
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
      status: stop.status,
    })) || []
  }
}

export async function deleteRoute(routeId: number) {
  const { role } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()

  const { data: route, error: fetchError } = await supabase
    .from('routes')
    .select('status')
    .eq('id', routeId)
    .single()

  if (fetchError) throw fetchError

  // route_stops and delivery_logs both cascade-delete with their route, so
  // deleting a route that's already been driven would wipe real delivery
  // history along with it. Only pending/cancelled routes are safe to remove
  // outright; anything else should be cancelled instead, not deleted.
  if (route.status === 'completed' || route.status === 'in-progress' || route.status === 'in_progress') {
    throw new Error(
      `Can't delete a route that's ${route.status === 'completed' ? 'already completed' : 'in progress'} — this would also delete its delivery history. Cancel it instead if it needs to be stopped.`,
    )
  }

  const { error } = await supabase.from('routes').delete().eq('id', routeId)

  if (error) throw error
}

export async function updateRoute(routeId: number, routeData: {
  name: string
  startTime?: string
  estimatedDuration?: number
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

  // Preserve the route's existing scheduled date - only the time-of-day is
  // being edited here. This previously always substituted today's date,
  // meaning editing a route's time silently moved its whole schedule to
  // today regardless of what date it was actually set for.
  const { data: existingRoute } = await supabase
    .from('routes')
    .select('start_time, estimated_duration')
    .eq('id', routeId)
    .single()
  const baseDate = existingRoute?.start_time ? new Date(existingRoute.start_time) : new Date()

  const buildTimestamp = (timeStr?: string) => {
    if (!timeStr) return null
    const d = new Date(baseDate)
    const [hours, minutes] = timeStr.split(':')
    d.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    return d.toISOString()
  }

  const startTimeTimestamp = buildTimestamp(routeData.startTime) || baseDate.toISOString()
  // No manual end time anymore - derived from the estimated duration.
  // This form doesn't let the admin edit duration, so fall back to the
  // route's existing duration rather than wiping out an already-good
  // end_time just because the name or stops changed.
  const effectiveDuration = routeData.estimatedDuration ?? existingRoute?.estimated_duration ?? undefined
  const endTimeTimestamp = effectiveDuration
    ? new Date(new Date(startTimeTimestamp).getTime() + effectiveDuration * 60000).toISOString()
    : null
  
  // Update the route
  const { error: routeError } = await supabase
    .from('routes')
    .update({
      name: routeData.name,
      start_time: startTimeTimestamp,
      end_time: endTimeTimestamp,
      estimated_duration: effectiveDuration ?? null,
      priority: routeData.priority,
      status: routeData.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routeId)

  if (routeError) throw routeError

  // Fetch existing stops so we know which are safe to change. A stop that's
  // already delivered or failed carries real captured data (signature,
  // recipient name, actual_delivery_time, photos) - that must never be
  // deleted or overwritten just because the route got edited. Only stops
  // still pending are actually added, updated, or removed here.
  const { data: existingStops, error: existingStopsError } = await supabase
    .from('route_stops')
    .select('id, status')
    .eq('route_id', routeId)

  if (existingStopsError) throw existingStopsError

  const resolvedStopIds = new Set((existingStops || []).filter(s => s.status !== 'pending').map(s => s.id))
  const pendingStopsById = new Map((existingStops || []).filter(s => s.status === 'pending').map(s => [s.id, s]))
  const incomingIds = new Set(routeData.stops.filter(s => s.id).map(s => s.id))

  // Remove pending stops the admin took out of the form. Resolved stops are
  // never touched here even if they're missing from the incoming list.
  const idsToDelete = Array.from(pendingStopsById.keys()).filter(id => !incomingIds.has(id))
  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase.from('route_stops').delete().in('id', idsToDelete)
    if (deleteError) throw deleteError
  }

  // Update pending stops that still exist. A stop the admin submitted whose
  // id belongs to an already-resolved stop is intentionally skipped - its
  // real delivery data stays exactly as captured.
  for (const stop of routeData.stops) {
    if (stop.id && pendingStopsById.has(stop.id) && !resolvedStopIds.has(stop.id)) {
      const { error: updateStopError } = await supabase
        .from('route_stops')
        .update({
          pharmacy_id: stop.pharmacyId,
          pickup_address: stop.pickupAddress,
          dropoff_address: stop.dropoffAddress,
          stop_order: stop.stopOrder,
        })
        .eq('id', stop.id)
      if (updateStopError) throw updateStopError
    }
  }

  // Insert genuinely new stops - no id, or an id that doesn't match any
  // existing pending stop.
  const newStops = routeData.stops.filter(s => !s.id || (!pendingStopsById.has(s.id) && !resolvedStopIds.has(s.id)))
  if (newStops.length > 0) {
    const stopsToInsert = newStops.map(stop => ({
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
  }

  return { success: true }
}

/**
 * Series-aware wrapper around updateRoute. 'this' just delegates straight
 * through. 'following' also updates the series template (so future
 * regenerations match) and propagates the same changes to every other
 * still-pending occurrence in the series dated on or after this one -
 * in-progress or completed occurrences are left alone entirely, not just
 * their stops, since retroactively changing a route that's already done
 * doesn't make sense.
 */
export async function updateRouteOccurrence(
  routeId: number,
  routeData: {
    name: string
    startTime?: string
    estimatedDuration?: number
    priority: string
    status: string
    driverId?: string | null
    stops: Array<{
      id?: string
      pharmacyId: string
      pickupAddress: string
      dropoffAddress: string
      stopOrder: number
    }>
  },
  scope: 'this' | 'following',
) {
  const { role } = await verifyAuth()
  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  await updateRoute(routeId, routeData)

  if (routeData.driverId !== undefined) {
    const supabase = createAdminClient()
    await supabase
      .from('routes')
      .update({ driver_id: routeData.driverId, driver_confirmation: 'pending', confirmation_resolved_at: null })
      .eq('id', routeId)
  }

  if (scope === 'this') {
    return { success: true, occurrencesUpdated: 1 }
  }

  const supabase = createAdminClient()

  const { data: thisRoute, error: thisRouteError } = await supabase
    .from('routes')
    .select('series_id, start_time')
    .eq('id', routeId)
    .single()

  if (thisRouteError) throw thisRouteError
  if (!thisRoute?.series_id) {
    // Not part of a series - 'following' is meaningless, already handled above.
    return { success: true, occurrencesUpdated: 1 }
  }

  // Keep the series template in sync so any future manual regeneration
  // matches what was just edited.
  await supabase
    .from('route_series')
    .update({
      name: routeData.name,
      priority: routeData.priority,
      start_time_of_day: routeData.startTime || null,
      estimated_duration: routeData.estimatedDuration || null,
      driver_id: routeData.driverId !== undefined ? routeData.driverId : undefined,
      stops_template: routeData.stops.map((s, i) => ({
        pharmacyId: s.pharmacyId,
        pickupAddress: s.pickupAddress,
        dropoffAddress: s.dropoffAddress,
        sequence: i + 1,
      })),
    })
    .eq('id', thisRoute.series_id)

  const { data: futureOccurrences, error: futureError } = await supabase
    .from('routes')
    .select('id')
    .eq('series_id', thisRoute.series_id)
    .eq('status', 'pending')
    .gte('start_time', thisRoute.start_time)
    .neq('id', routeId)

  if (futureError) throw futureError

  let updatedCount = 1
  for (const occurrence of futureOccurrences || []) {
    // Each occurrence keeps its own stop ids, so stops are replaced wholesale
    // here rather than trying to map ids across different occurrences.
    const { data: existingStops } = await supabase
      .from('route_stops')
      .select('id, status')
      .eq('route_id', occurrence.id)

    const stillPending = (existingStops || []).every((s) => s.status === 'pending')
    if (!stillPending) continue // a stop was already worked on somehow - leave this occurrence alone

    await supabase.from('route_stops').delete().eq('route_id', occurrence.id).eq('status', 'pending')

    const newStops = routeData.stops.map((s, i) => ({
      route_id: occurrence.id,
      pharmacy_id: s.pharmacyId,
      pickup_address: s.pickupAddress,
      dropoff_address: s.dropoffAddress,
      stop_order: i + 1,
      status: 'pending',
    }))
    await supabase.from('route_stops').insert(newStops)

    const updatePayload: Record<string, any> = {
      name: routeData.name,
      priority: routeData.priority,
      updated_at: new Date().toISOString(),
    }
    if (routeData.driverId !== undefined) {
      updatePayload.driver_id = routeData.driverId
      updatePayload.driver_confirmation = 'pending'
      updatePayload.confirmation_resolved_at = null
    }
    // Re-derive each occurrence's own date, only changing the time-of-day.
    // end_time is always recomputed here from whichever start time and
    // duration end up applying, so it can never drift out of sync.
    const { data: occRoute } = await supabase
      .from('routes')
      .select('start_time, estimated_duration')
      .eq('id', occurrence.id)
      .single()
    const baseDate = occRoute?.start_time ? new Date(occRoute.start_time) : new Date()
    let effectiveStartTimestamp = baseDate.toISOString()
    if (routeData.startTime) {
      const d = new Date(baseDate)
      const [h, m] = routeData.startTime.split(':')
      d.setHours(parseInt(h), parseInt(m), 0, 0)
      effectiveStartTimestamp = d.toISOString()
      updatePayload.start_time = effectiveStartTimestamp
    }
    const effectiveOccurrenceDuration = routeData.estimatedDuration ?? occRoute?.estimated_duration ?? undefined
    updatePayload.estimated_duration = effectiveOccurrenceDuration ?? null
    updatePayload.end_time = effectiveOccurrenceDuration
      ? new Date(new Date(effectiveStartTimestamp).getTime() + effectiveOccurrenceDuration * 60000).toISOString()
      : null

    await supabase.from('routes').update(updatePayload).eq('id', occurrence.id)
    updatedCount++
  }

  return { success: true, occurrencesUpdated: updatedCount }
}

export async function broadcastMessageToAllDrivers(content: string) {
  const { role, userId } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()

  const { data: drivers, error: driversError } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'driver')

  if (driversError) throw driversError
  if (!drivers || drivers.length === 0) {
    return { sentTo: 0 }
  }

  const driverIds = drivers.map((d) => d.id)

  // Find each driver's existing dispatch conversation, if they have one
  const { data: existingParticipants, error: participantsError } = await supabase
    .from('conversation_participants')
    .select('user_id, conversation_id, conversations!inner(type)')
    .in('user_id', driverIds)
    .eq('conversations.type', 'dispatch')

  if (participantsError) throw participantsError

  const driverIdToConversationId = new Map<string, string>()
  for (const p of existingParticipants || []) {
    driverIdToConversationId.set(p.user_id, p.conversation_id)
  }

  // Any driver who's never opened dispatch yet doesn't have a conversation
  // to broadcast into — create one so the message reaches them too, same
  // as if they'd sent the first message themselves.
  const driversNeedingConversation = driverIds.filter((id) => !driverIdToConversationId.has(id))

  for (const driverId of driversNeedingConversation) {
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({ type: 'dispatch' })
      .select()
      .single()

    if (convError) throw convError

    const { error: partError } = await supabase
      .from('conversation_participants')
      .insert({ conversation_id: conversation.id, user_id: driverId })

    if (partError) throw partError

    driverIdToConversationId.set(driverId, conversation.id)
  }

  const messagesToInsert = Array.from(driverIdToConversationId.values()).map((conversationId) => ({
    conversation_id: conversationId,
    sender_id: userId,
    content,
  }))

  const { error: insertError } = await supabase.from('messages').insert(messagesToInsert)

  if (insertError) throw insertError

  return { sentTo: messagesToInsert.length }
}

export async function createRouteRequest(input: {
  stops: Array<{ address: string; lat?: number | null; lng?: number | null }>
  isEmergency: boolean
  sourceLink?: string | null
}) {
  const { userId, role } = await verifyAuth()

  if (role !== 'pharmacy') {
    throw new Error('Forbidden: pharmacy account required')
  }

  if (input.stops.length === 0) {
    throw new Error('At least one delivery address is required')
  }

  const supabase = createAdminClient()

  const { data: pharmacyUser, error: lookupError } = await supabase
    .from('pharmacy_users')
    .select('pharmacy_id')
    .eq('id', userId)
    .single()

  if (lookupError) throw lookupError
  if (!pharmacyUser?.pharmacy_id) throw new Error('No pharmacy is linked to this account')

  const { data, error } = await supabase
    .from('route_requests')
    .insert({
      pharmacy_id: pharmacyUser.pharmacy_id,
      requested_by: userId,
      source_link: input.sourceLink || null,
      stops: input.stops,
      is_emergency: input.isEmergency,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getRouteRequests() {
  const { role } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('route_requests')
    .select('*, pharmacies(name, address, region)')
    .eq('status', 'pending')
    .order('is_emergency', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function dismissRouteRequest(requestId: string) {
  const { role } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('route_requests')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('id', requestId)

  if (error) throw error
  return { success: true }
}

/**
 * Turns a pending request into a real route and assigns a driver in one
 * step - reuses createRoute/assignDriverToRoute rather than duplicating
 * their logic, since this is exactly what those already do.
 */
export async function assignRouteRequestToDriver(input: {
  requestId: string
  driverId: string
  routeName: string
  priority: string
  startTime?: string
}) {
  const { role } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()

  const { data: request, error: requestError } = await supabase
    .from('route_requests')
    .select('*, pharmacies(address)')
    .eq('id', input.requestId)
    .single()

  if (requestError) throw requestError
  if (request.status !== 'pending') throw new Error('This request has already been resolved')

  const pharmacyAddress = (request as any).pharmacies?.address || ''
  const stops = (request.stops as Array<{ address: string; lat?: number | null; lng?: number | null }>).map(
    (s, index) => ({
      pharmacyId: request.pharmacy_id,
      pickupAddress: pharmacyAddress,
      dropoffAddress: s.address,
      dropoffLatitude: s.lat ?? null,
      dropoffLongitude: s.lng ?? null,
      sequence: index + 1,
    }),
  )

  const route = await createRoute({
    name: input.routeName,
    priority: input.priority,
    startTime: input.startTime,
    // Same 30-min-per-stop default estimate used when adding a route
    // manually, so end_time still gets derived sensibly here too.
    estimatedDuration: stops.length * 30,
    stops,
  })

  await assignDriverToRoute(route.id, input.driverId)

  const { error: updateError } = await supabase
    .from('route_requests')
    .update({ status: 'assigned', route_id: route.id, resolved_at: new Date().toISOString() })
    .eq('id', input.requestId)

  if (updateError) throw updateError

  return route
}

export async function getPharmacyReports() {
  const { role } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('pharmacy_reports')
    .select('*, pharmacies(name)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function resolvePharmacyReport(reportId: string) {
  const { role } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('pharmacy_reports')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', reportId)

  if (error) throw error
}

// Signatures live in a private storage bucket that only the uploading driver
// or an admin can read directly (see 004_delivery_confirmation.sql) - a
// pharmacy viewing their own delivery's signature doesn't fit either of
// those, so this does the authorization check here in application code
// (does this stop actually belong to this pharmacy?) before using the
// service-role client to generate the signed URL.
export async function getDeliverySignatureUrl(stopId: string, signatureType: 'delivery' | 'return' = 'delivery') {
  const { userId, role } = await verifyAuth()

  const supabase = createAdminClient()

  const { data: stop, error: stopError } = await supabase
    .from('route_stops')
    .select('signature_path, return_signature_path, pharmacy_id')
    .eq('id', stopId)
    .single()

  if (stopError) throw stopError

  const path = signatureType === 'return' ? stop.return_signature_path : stop.signature_path
  if (!path) throw new Error('No signature on file for this delivery')

  if (role !== 'admin') {
    const { data: pharmacyUser } = await supabase
      .from('pharmacy_users')
      .select('pharmacy_id')
      .eq('id', userId)
      .single()

    if (!pharmacyUser || pharmacyUser.pharmacy_id !== stop.pharmacy_id) {
      throw new Error('Forbidden: You do not have access to this delivery')
    }
  }

  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from('proof-of-delivery')
    .createSignedUrl(path, 3600)

  if (urlError) throw urlError

  return signedUrlData.signedUrl
}

export async function getDispatchConversations() {
  const { role, userId } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()

  const { data: conversations, error } = await supabase
    .from('conversations')
    .select(`
      id,
      created_at,
      conversation_participants(user_id, users(first_name, last_name)),
      messages(content, created_at, sender_id)
    `)
    .eq('type', 'dispatch')
    .order('created_at', { ascending: false })

  if (error) throw error

  const { data: readRows } = await supabase
    .from('admin_message_reads')
    .select('conversation_id, last_read_at')
    .eq('admin_id', userId)

  const lastReadByConversation = new Map((readRows || []).map((r) => [r.conversation_id, r.last_read_at]))

  return (conversations || []).map((c: any) => {
    const driverParticipant = c.conversation_participants?.[0]
    const sortedMessages = [...(c.messages || [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    const lastMessage = sortedMessages[0]
    const lastReadAt = lastReadByConversation.get(c.id)

    const unreadCount = (c.messages || []).filter(
      (m: any) => m.sender_id !== userId && (!lastReadAt || new Date(m.created_at) > new Date(lastReadAt)),
    ).length

    return {
      id: c.id,
      driverName: driverParticipant?.users
        ? `${driverParticipant.users.first_name || ''} ${driverParticipant.users.last_name || ''}`.trim()
        : 'Unknown Driver',
      driverId: driverParticipant?.user_id,
      lastMessage: lastMessage?.content || null,
      lastMessageAt: lastMessage?.created_at || c.created_at,
      unreadCount,
    }
  })
}

export async function getAnnouncements() {
  const { role } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createAnnouncement(input: {
  message: string
  severity: 'info' | 'warning' | 'critical'
  audience: 'all' | 'admin' | 'driver' | 'pharmacy'
  expiresAt?: string | null
}) {
  const { role, userId } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      message: input.message,
      severity: input.severity,
      audience: input.audience,
      expires_at: input.expiresAt || null,
      created_by: userId,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateAnnouncement(
  announcementId: string,
  updates: { message?: string; severity?: string; audience?: string; isActive?: boolean; expiresAt?: string | null },
) {
  const { role } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('announcements')
    .update({
      ...(updates.message !== undefined && { message: updates.message }),
      ...(updates.severity !== undefined && { severity: updates.severity }),
      ...(updates.audience !== undefined && { audience: updates.audience }),
      ...(updates.isActive !== undefined && { is_active: updates.isActive }),
      ...(updates.expiresAt !== undefined && { expires_at: updates.expiresAt }),
    })
    .eq('id', announcementId)

  if (error) throw error
}

export async function deleteAnnouncement(announcementId: string) {
  const { role } = await verifyAuth()

  if (role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('announcements').delete().eq('id', announcementId)

  if (error) throw error
}

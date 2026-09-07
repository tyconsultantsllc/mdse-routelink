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
    .select('*, route_stops(*, pharmacies(name, address, latitude, longitude))')
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
  startDate?: string
  startTime?: string
  endTime?: string
  estimatedDuration?: number
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

  // startDate defaults to today only for backward compatibility with
  // callers that don't pass one - previously this ALWAYS used today
  // regardless of what date was intended, which silently broke scheduling
  // a route for any date other than today (the whole point of the calendar).
  const buildTimestamp = (timeStr?: string) => {
    if (!timeStr) return null
    const baseDate = routeData.startDate ? new Date(`${routeData.startDate}T00:00:00`) : new Date()
    const [hours, minutes] = timeStr.split(':')
    baseDate.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    return baseDate.toISOString()
  }

  const startTimeTimestamp = buildTimestamp(routeData.startTime)
  const endTimeTimestamp = buildTimestamp(routeData.endTime)
  
  // Insert the route
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .insert({
      name: routeData.name,
      start_time: startTimeTimestamp,
      end_time: endTimeTimestamp,
      estimated_duration: routeData.estimatedDuration || null,
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
  endTime?: string
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
  const { data: existingRoute } = await supabase.from('routes').select('start_time').eq('id', routeId).single()
  const baseDate = existingRoute?.start_time ? new Date(existingRoute.start_time) : new Date()

  const buildTimestamp = (timeStr?: string) => {
    if (!timeStr) return null
    const d = new Date(baseDate)
    const [hours, minutes] = timeStr.split(':')
    d.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    return d.toISOString()
  }

  const startTimeTimestamp = buildTimestamp(routeData.startTime)
  const endTimeTimestamp = buildTimestamp(routeData.endTime)
  
  // Update the route
  const { error: routeError } = await supabase
    .from('routes')
    .update({
      name: routeData.name,
      start_time: startTimeTimestamp,
      end_time: endTimeTimestamp,
      estimated_duration: routeData.estimatedDuration,
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
export async function getDeliverySignatureUrl(stopId: string) {
  const { userId, role } = await verifyAuth()

  const supabase = createAdminClient()

  const { data: stop, error: stopError } = await supabase
    .from('route_stops')
    .select('signature_path, pharmacy_id')
    .eq('id', stopId)
    .single()

  if (stopError) throw stopError
  if (!stop.signature_path) throw new Error('No signature on file for this delivery')

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
    .createSignedUrl(stop.signature_path, 3600)

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

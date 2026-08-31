import { createClient } from "@/lib/supabase/client"

/**
 * These run in the browser using the anon Supabase client, matching how the
 * rest of the driver portal already works. They rely on the existing RLS
 * policies that scope writes to the signed-in driver:
 *   - routes_update_driver / route_stops_update_driver (driver_id = auth.uid())
 *   - delivery_logs_insert_driver_admin
 *   - storage policies in scripts/004_delivery_confirmation.sql
 * Run scripts/004_delivery_confirmation.sql in Supabase before using these.
 */

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

export async function uploadSignature(driverId: string, stopId: number, signatureDataUrl: string) {
  const supabase = createClient()
  const blob = await dataUrlToBlob(signatureDataUrl)
  const path = `${driverId}/${stopId}-${Date.now()}.png`

  const { error } = await supabase.storage.from("proof-of-delivery").upload(path, blob, {
    contentType: "image/png",
    upsert: true,
  })

  if (error) throw new Error(`Signature upload failed: ${error.message}`)
  return path
}

export async function getSignedUrl(path: string, expiresInSeconds = 3600) {
  const supabase = createClient()
  const { data, error } = await supabase.storage.from("proof-of-delivery").createSignedUrl(path, expiresInSeconds)
  if (error) throw new Error(`Could not get signature URL: ${error.message}`)
  return data.signedUrl
}

interface ConfirmDeliveryParams {
  stopId: number
  routeId: number
  pharmacyId: string
  driverId: string
  recipientName: string
  notes: string
  signatureDataUrl: string
}

export async function confirmDeliveryStop(params: ConfirmDeliveryParams) {
  const supabase = createClient()

  const signaturePath = await uploadSignature(params.driverId, params.stopId, params.signatureDataUrl)

  const { error: stopError } = await supabase
    .from("route_stops")
    .update({
      status: "delivered",
      actual_delivery_time: new Date().toISOString(),
      recipient_name: params.recipientName,
      signature_path: signaturePath,
      notes: params.notes || null,
    })
    .eq("id", params.stopId)

  if (stopError) throw new Error(`Could not save delivery confirmation: ${stopError.message}`)

  const { error: logError } = await supabase.from("delivery_logs").insert({
    route_id: params.routeId,
    route_stop_id: params.stopId,
    driver_id: params.driverId,
    pharmacy_id: params.pharmacyId,
    action: "delivered",
    notes: params.notes || null,
  })

  // The stop is already saved at this point; a logging failure shouldn't
  // roll that back or block the driver, but it should surface somewhere.
  if (logError) console.error("Delivery log insert failed:", logError.message)

  return { signaturePath }
}

export async function completeRoute(routeId: number) {
  const supabase = createClient()

  const { error } = await supabase
    .from("routes")
    .update({
      status: "completed",
      actual_end_time: new Date().toISOString(),
    })
    .eq("id", routeId)

  if (error) throw new Error(`Could not complete route: ${error.message}`)
}

export async function updateDriverLocation(driverId: string, latitude: number, longitude: number) {
  const supabase = createClient()

  const { error } = await supabase
    .from("drivers")
    .update({
      current_latitude: latitude,
      current_longitude: longitude,
      last_location_update: new Date().toISOString(),
    })
    .eq("id", driverId)

  if (error) throw new Error(`Could not save location: ${error.message}`)
}

export async function startStop(routeId: number, stopId: number, isFirstStopOnRoute: boolean) {
  const supabase = createClient()

  const { error: stopError } = await supabase
    .from("route_stops")
    .update({
      status: "picked_up",
      actual_pickup_time: new Date().toISOString(),
    })
    .eq("id", stopId)

  if (stopError) throw new Error(`Could not start stop: ${stopError.message}`)

  if (isFirstStopOnRoute) {
    const { error: routeError } = await supabase
      .from("routes")
      .update({
        status: "in-progress",
        actual_start_time: new Date().toISOString(),
      })
      .eq("id", routeId)

    if (routeError) throw new Error(`Could not start route: ${routeError.message}`)
  }
}

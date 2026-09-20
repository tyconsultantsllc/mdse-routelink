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

export async function uploadDeliveryPhotos(driverId: string, stopId: number, photoDataUrls: string[]): Promise<string[]> {
  const supabase = createClient()

  const paths = await Promise.all(
    photoDataUrls.map(async (dataUrl, index) => {
      const blob = await dataUrlToBlob(dataUrl)
      const path = `${driverId}/${stopId}-photo-${Date.now()}-${index}.jpg`

      const { error } = await supabase.storage.from("proof-of-delivery").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      })

      if (error) throw new Error(`Photo upload failed: ${error.message}`)
      return path
    }),
  )

  return paths
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
  photos?: string[]
  latitude?: number | null
  longitude?: number | null
}

export async function confirmDeliveryStop(params: ConfirmDeliveryParams) {
  const supabase = createClient()

  const signaturePath = await uploadSignature(params.driverId, params.stopId, params.signatureDataUrl)

  const photoPaths =
    params.photos && params.photos.length > 0
      ? await uploadDeliveryPhotos(params.driverId, params.stopId, params.photos)
      : []

  const { error: stopError } = await supabase
    .from("route_stops")
    .update({
      status: "delivered",
      actual_delivery_time: new Date().toISOString(),
      recipient_name: params.recipientName,
      signature_path: signaturePath,
      photo_paths: photoPaths,
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
    latitude: params.latitude ?? null,
    longitude: params.longitude ?? null,
  })

  // The stop is already saved at this point; a logging failure shouldn't
  // roll that back or block the driver, but it should surface somewhere.
  if (logError) console.error("Delivery log insert failed:", logError.message)

  return { signaturePath, photoPaths }
}

export async function failDeliveryStop(params: {
  stopId: number
  routeId: number
  pharmacyId: string
  driverId: string
  reason: string
  latitude?: number | null
  longitude?: number | null
}) {
  const supabase = createClient()

  const { error: stopError } = await supabase
    .from("route_stops")
    .update({
      status: "failed",
      notes: params.reason,
    })
    .eq("id", params.stopId)

  if (stopError) throw new Error(`Could not record failed delivery: ${stopError.message}`)

  const { error: logError } = await supabase.from("delivery_logs").insert({
    route_id: params.routeId,
    route_stop_id: params.stopId,
    driver_id: params.driverId,
    pharmacy_id: params.pharmacyId,
    action: "failed",
    notes: params.reason,
    latitude: params.latitude ?? null,
    longitude: params.longitude ?? null,
  })

  if (logError) console.error("Delivery log insert failed:", logError.message)
}

interface ConfirmReturnParams {
  stops: Array<{ stopId: number; routeId: number; pharmacyId: string }>
  driverId: string
  confirmedBy: string
  signatureDataUrl: string
  latitude?: number | null
  longitude?: number | null
}

/**
 * Confirms that failed-delivery items have been physically returned to the
 * pharmacy and signed for. Called once with multiple stops for a pharmacy
 * using "batch" mode (one signature covers all of them), or once per stop
 * for a pharmacy using "per_item" mode - the underlying operation is the
 * same either way, just with a different-sized stops array.
 */
export async function confirmReturnToPharmacy(params: ConfirmReturnParams) {
  if (params.stops.length === 0) throw new Error("No stops to return")

  const supabase = createClient()

  // One upload serves every stop in this call, whether that's a single
  // per-item return or an entire batch signing off together.
  const signaturePath = await uploadSignature(
    params.driverId,
    params.stops[0].stopId,
    params.signatureDataUrl,
  )

  const confirmedAt = new Date().toISOString()

  const stopUpdates = await Promise.all(
    params.stops.map(async (stop) => {
      const { data, error } = await supabase
        .from("route_stops")
        .update({
          status: "returned",
          return_confirmed_by: params.confirmedBy,
          return_signature_path: signaturePath,
          return_confirmed_at: confirmedAt,
        })
        .eq("id", stop.stopId)
        .select()

      return { stop, error, matched: (data?.length ?? 0) > 0 }
    }),
  )

  const failures = stopUpdates.filter((r) => r.error || !r.matched)
  if (failures.length > 0) {
    throw new Error(
      `Could not confirm return for ${failures.length} of ${params.stops.length} item(s): ` +
        failures.map((f) => f.error?.message || "no matching stop found").join("; "),
    )
  }

  const logResults = await Promise.all(
    params.stops.map((stop) =>
      supabase.from("delivery_logs").insert({
        route_id: stop.routeId,
        route_stop_id: stop.stopId,
        driver_id: params.driverId,
        pharmacy_id: stop.pharmacyId,
        action: "returned",
        notes: `Returned to pharmacy, received by ${params.confirmedBy}`,
        latitude: params.latitude ?? null,
        longitude: params.longitude ?? null,
      }),
    ),
  )

  logResults.forEach((r) => {
    if (r.error) console.error("Return delivery log insert failed:", r.error.message)
  })

  return { signaturePath, confirmedCount: params.stops.length }
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

export interface ParsedStop {
  lat: number
  lng: number
  address: string
  label: string
}

export interface ParsedRoute {
  pharmacyStop: ParsedStop
  deliveryStops: ParsedStop[]
}

/**
 * Parses a Bing Maps multi-stop directions link into its waypoints.
 *
 * Bing encodes each waypoint in the `rtp` query parameter as
 * `pos.{lat}_{lng}_{address}_{label}_`, joined by `~`, with the address and
 * label double URL-encoded. `URLSearchParams.get()` already performs one
 * decode pass, so only the address/label segments need a second
 * `decodeURIComponent` to fully resolve.
 *
 * A route built this way starts and ends at the pharmacy (a round trip), so
 * the first waypoint is split out as the pharmacy stop, and a trailing
 * waypoint that matches it is dropped rather than treated as an 11th
 * delivery.
 *
 * Returns null if the link isn't a recognizable Bing directions link -
 * callers should fall back to manual address entry in that case.
 */
export function parseBingMapsLink(url: string): ParsedRoute | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes("bing.com")) return null

    const rtp = parsed.searchParams.get("rtp")
    if (!rtp) return null

    const waypoints = rtp
      .split("~")
      .map((w) => w.trim())
      .filter(Boolean)

    const stops: ParsedStop[] = waypoints
      .map((w) => {
        const body = w.replace(/^pos\./, "")
        const parts = body.split("_")
        const lat = Number.parseFloat(parts[0])
        const lng = Number.parseFloat(parts[1])
        const address = decodeURIComponent(parts[2] || "")
        const label = decodeURIComponent(parts[3] || "")
        return { lat, lng, address, label }
      })
      .filter((s) => !Number.isNaN(s.lat) && !Number.isNaN(s.lng) && s.address)

    if (stops.length === 0) return null

    // Drop a trailing return-to-pharmacy leg (last stop essentially
    // identical to the first) rather than showing it as a delivery stop.
    if (stops.length > 1) {
      const first = stops[0]
      const last = stops[stops.length - 1]
      const isRoundTrip = Math.abs(first.lat - last.lat) < 0.0005 && Math.abs(first.lng - last.lng) < 0.0005
      if (isRoundTrip) stops.pop()
    }

    const [pharmacyStop, ...deliveryStops] = stops
    return { pharmacyStop, deliveryStops }
  } catch {
    return null
  }
}

/**
 * Extracts the ordered list of stop addresses from a Google Maps
 * directions link. Unlike a Bing link, Google never carries per-stop
 * coordinates in the URL - callers need to geocode each returned address
 * themselves, the same as the manual address-list path.
 *
 * Google encodes stops two different ways depending on how the link was
 * shared:
 *  - As URL path segments: /maps/dir/Addr+One/Addr+Two/Addr+Three/@lat,lng,z
 *  - As query params: /maps/dir/?api=1&origin=...&destination=...&waypoints=A|B
 *
 * A trailing round-trip leg back to the first stop is dropped, and the
 * first stop itself is treated as the pharmacy/pickup location and
 * excluded from the returned delivery stops - both match parseBingMapsLink's
 * conventions so the two can be used interchangeably by callers.
 *
 * Returns 'shortened' for a maps.app.goo.gl / goo.gl/maps link, since those
 * only resolve via a server-side redirect and can't be read from the URL
 * alone - callers should ask for the full, un-shortened link in that case.
 * Returns null if the link isn't a recognizable Google directions link at
 * all - callers should fall back to manual address entry.
 */
export function parseGoogleMapsLink(url: string): { deliveryStops: string[] } | "shortened" | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.hostname.includes("goo.gl")) {
    return "shortened"
  }

  if (!parsed.hostname.includes("google.")) return null
  if (!parsed.pathname.includes("/maps/dir")) return null

  let addresses: string[] = []

  const origin = parsed.searchParams.get("origin")
  const destination = parsed.searchParams.get("destination")
  if (origin && destination) {
    const waypoints = (parsed.searchParams.get("waypoints") || "")
      .split("|")
      .map((w) => w.trim())
      .filter(Boolean)
      .map((w) => decodeURIComponent(w.replace(/\+/g, " ")))
    addresses = [
      decodeURIComponent(origin.replace(/\+/g, " ")),
      ...waypoints,
      decodeURIComponent(destination.replace(/\+/g, " ")),
    ]
  } else {
    const dirIndex = parsed.pathname.indexOf("/dir/")
    if (dirIndex === -1) return null
    const afterDir = parsed.pathname.slice(dirIndex + 5)
    const segments = afterDir.split("/").filter(Boolean)
    addresses = segments
      .filter((seg) => !seg.startsWith("@") && !seg.startsWith("data="))
      .map((seg) => decodeURIComponent(seg.replace(/\+/g, " ")))
      .filter(Boolean)
  }

  if (addresses.length === 0) return null

  if (addresses.length > 1) {
    const first = addresses[0].trim().toLowerCase()
    const last = addresses[addresses.length - 1].trim().toLowerCase()
    if (first === last) addresses.pop()
  }

  const [, ...deliveryStops] = addresses
  return { deliveryStops }
}

/**
 * Splits a plain pasted list of addresses (one per line) into stops with no
 * coordinates yet - the caller is expected to geocode these, since this
 * path has no coordinates embedded the way a Bing link does.
 */
export function parseManualAddressList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

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

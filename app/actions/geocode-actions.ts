'use server'

/**
 * Server-side geocoding via Nominatim (OpenStreetMap). This used to be a
 * direct fetch from the browser (lib/geocode.ts and
 * components/address-autocomplete-input.tsx each had their own copy), but
 * browsers - and Capacitor's Android WebView - silently refuse to let
 * JavaScript set a custom `User-Agent` header on a fetch/XHR request (it's
 * a "forbidden header name" per the fetch spec, dropped and replaced with
 * the browser's own default no matter what's passed). So every one of
 * those client-side calls was always going out completely unidentified,
 * which is exactly what Nominatim's usage policy says not to do - it
 * requires a way to identify the calling application. Running the actual
 * request from here means the User-Agent below really gets sent, and
 * Nominatim sees one stable server IP instead of a different one per
 * device/tester, both of which make it far less likely to get silently
 * rate-limited or blocked the way the client-side version was.
 *
 * Nominatim's usage policy caps requests at ~1/second - callers geocoding
 * several addresses in a loop are responsible for spacing their own calls
 * out (several already do, with a 1100ms delay between each - see
 * route-optimizer-dialog.tsx and request-route-dialog.tsx).
 */
const NOMINATIM_USER_AGENT = "MDSE-RouteLink/1.0 (pharmacy delivery routing app)"

/**
 * Resolves one free-text address to coordinates. Returns null for an empty
 * query, no match, or any network/parse failure - never throws, since a
 * failed geocode shouldn't break whatever flow triggered it.
 */
export async function geocodeAddressAction(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address || address.trim().length < 3) return null

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=us&limit=1`,
      {
        headers: {
          "User-Agent": NOMINATIM_USER_AGENT,
        },
      },
    )

    if (!response.ok) return null

    const data = await response.json()
    if (!Array.isArray(data) || data.length === 0) return null

    const lat = Number.parseFloat(data[0].lat)
    const lng = Number.parseFloat(data[0].lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null

    return { lat, lng }
  } catch {
    return null
  }
}

/**
 * Returns up to 5 human-readable address suggestions for a partial query,
 * for live autocomplete-as-you-type. Returns an empty array for a short
 * query or any failure - never throws, matching geocodeAddressAction.
 */
export async function searchAddressSuggestionsAction(query: string): Promise<string[]> {
  if (!query || query.trim().length < 3) return []

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=us&limit=5&addressdetails=1`,
      {
        headers: {
          "User-Agent": NOMINATIM_USER_AGENT,
        },
      },
    )

    if (!response.ok) return []

    const data = await response.json()
    if (!Array.isArray(data)) return []

    return data.map((item: any) => item.display_name).filter(Boolean)
  } catch {
    return []
  }
}

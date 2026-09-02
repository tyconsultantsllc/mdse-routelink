/**
 * Geocode a free-text address to coordinates using Nominatim (OpenStreetMap).
 * Free, no API key required — same service already used by
 * components/address-autocomplete-input.tsx for address suggestions.
 *
 * Nominatim's usage policy caps public requests at ~1/second. Callers
 * geocoding multiple addresses in a loop should space calls out
 * accordingly (see route-optimizer-dialog.tsx).
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address || address.trim().length < 3) return null

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=us&limit=1`,
      {
        headers: {
          "User-Agent": "MDSE-RouteLink/1.0",
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

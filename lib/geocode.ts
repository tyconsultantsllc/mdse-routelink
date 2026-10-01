/**
 * Geocode a free-text address to coordinates. The actual Nominatim
 * (OpenStreetMap) call happens server-side now - see
 * app/actions/geocode-actions.ts for why (browsers silently strip a custom
 * User-Agent header from client-side requests, so calling Nominatim
 * directly from here never actually identified this app the way its usage
 * policy requires). This wrapper keeps the same signature every existing
 * caller already uses, so nothing else needed to change.
 *
 * Nominatim's usage policy caps requests at ~1/second. Callers geocoding
 * multiple addresses in a loop should space calls out accordingly (see
 * route-optimizer-dialog.tsx).
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const { geocodeAddressAction } = await import("@/app/actions/geocode-actions")
  return geocodeAddressAction(address)
}

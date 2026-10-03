export type Region = "socal" | "minnesota"

/**
 * Reads the nested driver record from a user row fetched with
 * `.select('*, drivers(*)')`. Because drivers.id is both that table's
 * primary key and the foreign key to users.id, this is a strict one-to-one
 * relationship - Supabase returns it as a single object, not an array.
 * Every `.drivers?.[0]` access in this codebase was wrong because of that;
 * this is the one place that logic should live going forward.
 */
export function getDriverDetails(userRow: any): any {
  if (!userRow) return null
  const drivers = userRow.drivers
  if (Array.isArray(drivers)) return drivers[0] || null
  return drivers || null
}

export const REGION_LABELS: Record<Region, string> = {
  socal: "SoCal",
  minnesota: "MN",
}

export const REGION_COLORS: Record<Region, string> = {
  socal: "bg-amber-100 text-amber-800 border-amber-300",
  minnesota: "bg-indigo-100 text-indigo-800 border-indigo-300",
}

// Same two regions, same color family as REGION_COLORS above (amber /
// indigo), but as plain hex - for contexts that can't use Tailwind classes,
// like a Leaflet marker's inline style or canvas-drawn icon.
export const REGION_MAP_COLORS: Record<Region, string> = {
  socal: "#f59e0b",
  minnesota: "#6366f1",
}

// Rough regional center points, used only as a location fallback when real
// coordinates aren't available yet (e.g. GPS hasn't reported, or a pharmacy
// has no geocoded address) - never shown as an actual precise location.
export const REGION_FALLBACK_COORDS: Record<Region, { lat: number; lng: number }> = {
  socal: { lat: 33.7175, lng: -117.8311 }, // Orange County, CA
  minnesota: { lat: 44.9537, lng: -93.09 }, // St. Paul, MN
}

/**
 * A route doesn't store its own region - it's derived from the pharmacies
 * its stops belong to, so it can never drift out of sync with reality.
 * Returns null if stops span more than one region (flagged as "Mixed"
 * rather than silently picking one), or if no stop has a region set yet.
 */
export function getRouteRegion(stops: { pharmacies?: { region?: Region | null } | null }[]): Region | null {
  const regions = new Set(
    stops.map((s) => s.pharmacies?.region).filter((r): r is Region => r === "socal" || r === "minnesota"),
  )
  if (regions.size === 1) return Array.from(regions)[0]
  return null
}

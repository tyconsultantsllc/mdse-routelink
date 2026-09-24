export interface ParsedAddress {
  mainAddress: string
  unit: string | null
}

// Ordered from most to least specific. Keyword-based patterns come before
// the bare "#4B" style fallback since a stray "#" is more likely to cause a
// false positive than an explicit word like "Suite" or "Apt".
const UNIT_PATTERNS: RegExp[] = [
  /,?\s*\b(suite|ste\.?)\s*#?\s*([a-z0-9-]+)\b/i,
  /,?\s*\b(apartment|apt\.?)\s*#?\s*([a-z0-9-]+)\b/i,
  /,?\s*\bunit\s*#?\s*([a-z0-9-]+)\b/i,
  /,?\s*\b(\d+)(st|nd|rd|th)\s+floor\b/i,
  /,?\s*\b(floor|fl\.?)\s*#?\s*([a-z0-9-]+)\b/i,
  /,?\s*\b(room|rm\.?)\s*#?\s*([a-z0-9-]+)\b/i,
  /,?\s*\b(building|bldg\.?)\s*#?\s*([a-z0-9-]+)\b/i,
  /,?\s*#\s*([a-z0-9-]+)\b/i,
]

/**
 * Pulls a floor/suite/unit/apartment/room/building designator out of a
 * plain address string, if one is present. Returns the address with that
 * portion removed (cleaned of any resulting double commas/spaces) plus the
 * extracted text on its own, so the caller can render them separately -
 * e.g. the unit as its own highlighted badge instead of a clause buried in
 * the middle of a long address that's easy to read past.
 */
export function parseAddressUnit(address: string | null | undefined): ParsedAddress {
  if (!address) return { mainAddress: address || "", unit: null }

  for (const pattern of UNIT_PATTERNS) {
    const match = address.match(pattern)
    if (match && match.index !== undefined) {
      const unit = match[0].replace(/^,?\s*/, "").trim()
      const mainAddress = (address.slice(0, match.index) + address.slice(match.index + match[0].length))
        .replace(/,\s*,/g, ",")
        .replace(/^\s*,\s*|\s*,\s*$/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()
      return { mainAddress, unit }
    }
  }

  return { mainAddress: address, unit: null }
}

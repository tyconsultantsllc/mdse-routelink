"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { geocodeAddress } from "@/lib/geocode"

// Leaflet's default marker icon points at image paths that only resolve
// correctly when served from Leaflet's own folder layout - bundled through
// webpack/Next.js like this, they 404 instead (confirmed in production:
// GET /admin/marker-icon-2x.png and /admin/marker-shadow.png both 404,
// resolved relative to the current page's own URL rather than to Leaflet's
// assets). This is a well-known Leaflet + webpack incompatibility; pointing
// the default icon at Leaflet's own CDN-hosted images is the standard fix.
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// Asks OSRM's free public routing demo for the real driving path through a
// series of points, in the order given (a "route" request, not "trip" - this
// app has already decided the stop order itself, so OSRM is never asked to
// reorder anything, only to draw the roads between the stops as sequenced).
// Returns null on any failure - network error, timeout, or no drivable path
// found - so the caller can fall back to a plain straight line instead of
// the map breaking. This is the same public-demo tradeoff already made for
// geocoding via Nominatim elsewhere in this file: free and good enough for
// this app's traffic, but not a paid, guaranteed-uptime service.
async function fetchRoadRoute(points: [number, number][]): Promise<[number, number][] | null> {
  if (points.length < 2) return null
  try {
    const coordsParam = points.map(([lat, lng]) => `${lng},${lat}`).join(";")
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson`,
      { signal: controller.signal },
    )
    clearTimeout(timeoutId)
    if (!response.ok) return null
    const data = await response.json()
    const coordinates = data?.routes?.[0]?.geometry?.coordinates
    if (!Array.isArray(coordinates) || coordinates.length === 0) return null
    // OSRM/GeoJSON coordinates are [lng, lat]; Leaflet wants [lat, lng].
    return coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number])
  } catch {
    return null
  }
}

interface RouteStop {
  id?: string
  stop_order: number
  dropoff_address: string
  dropoff_latitude?: number | null
  dropoff_longitude?: number | null
  is_priority?: boolean | null
  designated_time?: string | null
  pharmacies?: {
    name: string
    address: string
    latitude: number | null
    longitude: number | null
  } | null
}

interface RouteMapProps {
  highlightedRouteId?: string | null
  onHighlightMissing?: () => void
  onDrawSummary?: (summary: { routesDrawn: number; totalRoutes: number }) => void
  routes?: Array<{
    id: string
    name: string
    priority: string
    route_stops?: RouteStop[]
  }>
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#3b82f6",
  low: "#6b7280",
}

// A small numbered pin instead of Leaflet's plain default marker, so each
// stop's position in the route's order (1, 2, 3...) is visible directly on
// the map - without it, a route with several stops is just a wall of
// identical-looking pins with no visual sense of where it starts or ends.
function numberedDivIcon(label: string, opts: { bg: string; border: string; size?: number }) {
  const size = opts.size ?? 26
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${opts.bg};border:2px solid ${opts.border};display:flex;align-items:center;justify-content:center;color:#fff;font-size:${size <= 22 ? 10 : 12}px;line-height:1;font-weight:700;font-family:inherit;box-shadow:0 1px 4px rgba(0,0,0,0.45);">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function RouteMap({ highlightedRouteId, onHighlightMissing, onDrawSummary, routes = [] }: RouteMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const routeLayersRef = useRef<Map<string, L.Polyline>>(new Map())
  const [isGeocoding, setIsGeocoding] = useState(false)

  // Initialize the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView([39.8283, -98.5795], 4)
    mapRef.current = map

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    // Leaflet measures its container's size once, at init. In a flex/scroll
    // layout like this admin page, the container can still be mid-layout
    // (e.g. 0px tall) at that exact moment, which leaves Leaflet's internal
    // tile grid permanently wrong - no tiles, no visible map - until
    // something forces it to re-measure. invalidateSize() is that re-measure;
    // it's called a few times (next frame, then again after a short delay)
    // to catch layout that settles slightly late, and a ResizeObserver keeps
    // it correct if the surrounding layout changes afterward (e.g. a sidebar
    // toggling).
    const invalidate = () => mapRef.current?.invalidateSize()
    requestAnimationFrame(invalidate)
    const timer = setTimeout(invalidate, 300)

    const resizeObserver = new ResizeObserver(() => invalidate())
    resizeObserver.observe(containerRef.current)

    return () => {
      clearTimeout(timer)
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
      routeLayersRef.current.clear()
    }
  }, [])

  // Draw real routes whenever the routes prop changes
  useEffect(() => {
    if (!mapRef.current || routes.length === 0) return

    let cancelled = false

    const drawRoutes = async () => {
      setIsGeocoding(true)

      // Clear previous layers before redrawing
      routeLayersRef.current.forEach((layer) => mapRef.current?.removeLayer(layer))
      routeLayersRef.current.clear()

      const allPoints: [number, number][] = []
      let routesDrawn = 0

      // A labeled loop (rather than early `return`s from inside the nested
      // stop loop) so every exit path still falls through to the
      // `setIsGeocoding(false)` at the end - a naked `return` here used to
      // skip that and leave "Locating stops..." on screen forever once a
      // route with no map or a cancelled effect was hit mid-draw.
      routesLoop: for (const route of routes) {
        const stops = [...(route.route_stops || [])].sort((a, b) => a.stop_order - b.stop_order)
        if (stops.length === 0) continue

        const points: [number, number][] = []
        // Tracks, per pushed point, which stop it belongs to and whether
        // it's the priority-marked dropoff - kept alongside `points` rather
        // than derived from its index, since not every stop contributes
        // exactly two points (a stop with no pharmacy coordinates only
        // contributes its dropoff, for instance).
        const pointMeta: { stop: RouteStop; isPriorityDropoff: boolean }[] = []

        for (const stop of stops) {
          // Pickup: the pharmacy's real stored coordinates
          if (stop.pharmacies?.latitude != null && stop.pharmacies?.longitude != null) {
            points.push([stop.pharmacies.latitude, stop.pharmacies.longitude])
            pointMeta.push({ stop, isPriorityDropoff: false })
          }

          // Dropoff: prefer coordinates already stored on the stop (set at
          // creation time whenever they're known, e.g. from a parsed maps
          // link) - only fall back to a live geocode, which is slower,
          // rate-limited to ~1/second, and depends on Nominatim being
          // reachable right now, when nothing is stored yet.
          if (stop.dropoff_latitude != null && stop.dropoff_longitude != null) {
            points.push([stop.dropoff_latitude, stop.dropoff_longitude])
            pointMeta.push({ stop, isPriorityDropoff: !!stop.is_priority })
          } else if (stop.dropoff_address) {
            const coords = await geocodeAddress(stop.dropoff_address)
            if (cancelled) break routesLoop
            if (coords) {
              points.push([coords.lat, coords.lng])
              pointMeta.push({ stop, isPriorityDropoff: !!stop.is_priority })
              // Cache it on the stop so this exact address is never
              // live-geocoded again on a future load - fire-and-forget,
              // doesn't hold up drawing the map.
              if (stop.id) {
                import('@/app/actions/data-actions')
                  .then(({ updateStopCoordinates }) => updateStopCoordinates(stop.id!, coords.lat, coords.lng))
                  .catch(() => {})
              }
              // Nominatim's public server caps requests at ~1/second
              await new Promise((resolve) => setTimeout(resolve, 1100))
            }
          }
        }

        if (points.length === 0) continue
        if (!mapRef.current) break routesLoop

        const color = PRIORITY_COLORS[route.priority] || PRIORITY_COLORS.medium

        // Follow the actual roads between stops, in the order they're
        // already sequenced, instead of a straight line through fields and
        // buildings. Falls back to that same straight line if the routing
        // service can't be reached, times out, or can't find a drivable
        // path - so a hiccup here never breaks the map, it only loses the
        // road-following detail for that one route.
        const roadPath = await fetchRoadRoute(points)
        if (cancelled) break routesLoop
        if (!mapRef.current) break routesLoop
        const map = mapRef.current
        const linePoints = roadPath && roadPath.length > 0 ? roadPath : points

        const polyline = L.polyline(linePoints, { color, weight: 4, opacity: 0.7 }).addTo(map)
        polyline.bindPopup(`<strong>${route.name}</strong>`)
        routeLayersRef.current.set(route.id, polyline)

        const formatDesignatedTime = (time: string) => {
          const d = new Date(`1970-01-01T${time}`)
          return isNaN(d.getTime()) ? time : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        }

        points.forEach((point, index) => {
          const meta = pointMeta[index]
          const stop = meta?.stop
          const label = stop?.pharmacies?.name || "Stop"
          const stopNumber = stop?.stop_order
          const stopLabel = stopNumber != null ? `Stop ${stopNumber}` : "Stop"

          if (meta?.isPriorityDropoff) {
            const timeLine = stop?.designated_time
              ? `<br/>Requested for ${formatDesignatedTime(stop.designated_time)}`
              : ""
            L.marker(point, {
              icon: numberedDivIcon(stopNumber != null ? String(stopNumber) : "★", {
                bg: "#f59e0b",
                border: "#b45309",
                size: 28,
              }),
            })
              .addTo(map)
              .bindPopup(`<strong>${route.name}</strong><br/>⭐ Priority - ${stopLabel} - ${label}${timeLine}`)
          } else {
            L.marker(point, {
              icon: numberedDivIcon(stopNumber != null ? String(stopNumber) : "", {
                bg: color,
                border: "#ffffff",
              }),
            })
              .addTo(map)
              .bindPopup(`<strong>${route.name}</strong><br/>${stopLabel} - ${label}`)
          }
        })

        // Include the actual road path (not just the stop points) in the
        // fit-bounds calculation - a real road can bow out past the
        // straight-line box between two stops, and without this the map
        // could zoom to a view that clips part of the drawn route.
        allPoints.push(...points, ...linePoints)
        routesDrawn++
      }

      if (!cancelled && allPoints.length > 0) {
        mapRef.current?.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50] })
      }

      if (!cancelled) {
        setIsGeocoding(false)
        onDrawSummary?.({ routesDrawn, totalRoutes: routes.length })
      }
    }

    drawRoutes()

    return () => {
      cancelled = true
    }
  }, [routes])

  // Highlight a specific route (real UUID id, not the old fake numeric one)
  useEffect(() => {
    if (!mapRef.current || !highlightedRouteId) return

    const polyline = routeLayersRef.current.get(highlightedRouteId)
    if (polyline) {
      polyline.setStyle({ weight: 8, opacity: 1 })
      mapRef.current.fitBounds(polyline.getBounds(), { padding: [100, 100] })

      setTimeout(() => {
        polyline.setStyle({ weight: 4, opacity: 0.7 })
      }, 3000)
    } else {
      // Either this route has no usable coordinates on any of its stops,
      // or the map is still busy locating addresses for other routes -
      // either way, let the admin know rather than doing nothing visibly.
      onHighlightMissing?.()
    }
  }, [highlightedRouteId])

  return (
    <div className="relative">
      {/* Height is set inline, not via a Tailwind class, on purpose: once
          Leaflet initializes, it adds its own "leaflet-container" class to
          this exact element, and leaflet.css sets `.leaflet-container {
          height: 100% }` as a plain, un-layered rule. Tailwind's utility
          classes are emitted inside a CSS `@layer`, and per the CSS Cascade
          Layers spec, ANY un-layered rule beats a layered one regardless of
          specificity or source order - so a Tailwind `h-[500px]` class here
          always lost to Leaflet's `height: 100%`, and with no sized
          ancestor to inherit a percentage from, that resolved to 0. The map
          was never broken - it was rendering at 0 pixels tall, invisibly,
          every time. An inline style always wins over any stylesheet rule
          (layered or not), so it's the one thing that reliably fixes this. */}
      {/* `isolate` gives this its own stacking context - see admin-map.tsx
          for why: without it, Leaflet's internal panes (z-index up to 700)
          aren't contained to this box and can render above unrelated
          fixed-position UI elsewhere on the page. */}
      <div ref={containerRef} className="w-full rounded-lg isolate" style={{ height: 500 }} />
      {isGeocoding && (
        <div className="absolute top-2 right-2 bg-card border rounded-md px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          Locating stops...
        </div>
      )}
    </div>
  )
}

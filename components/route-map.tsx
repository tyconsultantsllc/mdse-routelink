"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { geocodeAddress } from "@/lib/geocode"

interface RouteStop {
  stop_order: number
  dropoff_address: string
  pharmacies?: {
    name: string
    address: string
    latitude: number | null
    longitude: number | null
  } | null
}

interface RouteMapProps {
  highlightedRouteId?: string | null
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

export default function RouteMap({ highlightedRouteId, routes = [] }: RouteMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const routeLayersRef = useRef<Map<string, L.Polyline>>(new Map())
  const [isGeocoding, setIsGeocoding] = useState(false)

  // Initialize the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView([33.7175, -117.8311], 11)
    mapRef.current = map

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    return () => {
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

      for (const route of routes) {
        const stops = [...(route.route_stops || [])].sort((a, b) => a.stop_order - b.stop_order)
        if (stops.length === 0) continue

        const points: [number, number][] = []

        for (const stop of stops) {
          // Pickup: the pharmacy's real stored coordinates
          if (stop.pharmacies?.latitude != null && stop.pharmacies?.longitude != null) {
            points.push([stop.pharmacies.latitude, stop.pharmacies.longitude])
          }

          // Dropoff: geocoded live, since delivery addresses are free text
          // with no stored coordinates (same approach as the route optimizer)
          if (stop.dropoff_address) {
            const coords = await geocodeAddress(stop.dropoff_address)
            if (cancelled) return
            if (coords) {
              points.push([coords.lat, coords.lng])
              // Nominatim's public server caps requests at ~1/second
              await new Promise((resolve) => setTimeout(resolve, 1100))
            }
          }
        }

        if (points.length === 0) continue

        const color = PRIORITY_COLORS[route.priority] || PRIORITY_COLORS.medium
        const polyline = L.polyline(points, { color, weight: 4, opacity: 0.7 }).addTo(mapRef.current!)
        polyline.bindPopup(`<strong>${route.name}</strong>`)
        routeLayersRef.current.set(route.id, polyline)

        points.forEach((point, index) => {
          const stop = stops[Math.floor(index / 2)]
          L.marker(point)
            .addTo(mapRef.current!)
            .bindPopup(`<strong>${route.name}</strong><br/>${stop?.pharmacies?.name || "Stop"}`)
        })

        allPoints.push(...points)
      }

      if (!cancelled && allPoints.length > 0) {
        mapRef.current?.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50] })
      }

      if (!cancelled) setIsGeocoding(false)
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
    }
  }, [highlightedRouteId])

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[500px] w-full rounded-lg" />
      {isGeocoding && (
        <div className="absolute top-2 right-2 bg-card border rounded-md px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          Locating stops...
        </div>
      )}
    </div>
  )
}

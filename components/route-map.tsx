"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface RouteMapProps {
  highlightedRouteId?: number | null
  routes?: Array<{
    id: number
    name: string
    priority: string
  }>
}

export default function RouteMap({ highlightedRouteId, routes }: RouteMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const routeLayersRef = useRef<Map<number, L.Polyline>>(new Map())

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView([33.7175, -117.8311], 12)
    mapRef.current = map

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    const routeData = [
      {
        id: 1,
        name: "Downtown Circuit",
        points: [
          [33.7175, -117.8311], // Santa Ana
          [33.7455, -117.8677], // Orange
          [33.7879, -117.8531], // Anaheim
        ],
        color: "#f97316", // orange for high priority
      },
      {
        id: 2,
        name: "Northside Express",
        points: [
          [33.7879, -117.8531], // Anaheim
          [33.8703, -117.9242], // Fullerton
          [33.8366, -117.9143], // Buena Park
          [33.8153, -117.939], // Cypress
          [33.7608, -117.9931], // Westminster
        ],
        color: "#ef4444", // red for urgent priority
      },
      {
        id: 3,
        name: "Westside Loop",
        points: [
          [33.6846, -117.8265], // Tustin
          [33.6595, -117.8231], // Irvine
          [33.6189, -117.9298], // Costa Mesa
          [33.6694, -117.9931], // Huntington Beach
        ],
        color: "#3b82f6", // blue for medium priority
      },
    ]

    routeData.forEach((route) => {
      const polyline = L.polyline(route.points as [number, number][], {
        color: route.color,
        weight: 4,
        opacity: 0.7,
      }).addTo(map)

      routeLayersRef.current.set(route.id, polyline)

      // Add markers for each stop
      route.points.forEach((point, index) => {
        L.marker(point as [number, number])
          .addTo(map)
          .bindPopup(`<strong>${route.name}</strong><br/>Stop ${index + 1}`)
      })
    })

    // Fit map to show all routes
    const allPoints = routeData.flatMap((r) => r.points) as [number, number][]
    if (allPoints.length > 0) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50] })
    }

    return () => {
      map.remove()
      mapRef.current = null
      routeLayersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !highlightedRouteId) return

    const polyline = routeLayersRef.current.get(highlightedRouteId)
    if (polyline) {
      // Temporarily make the route more prominent
      polyline.setStyle({ weight: 8, opacity: 1 })
      mapRef.current.fitBounds(polyline.getBounds(), { padding: [100, 100] })

      // Reset after 3 seconds
      setTimeout(() => {
        polyline.setStyle({ weight: 4, opacity: 0.7 })
      }, 3000)
    }
  }, [highlightedRouteId])

  return <div ref={containerRef} className="h-[500px] w-full rounded-lg" />
}

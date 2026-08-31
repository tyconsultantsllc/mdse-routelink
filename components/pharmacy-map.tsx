"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { generateMultiStopStreetPath } from "@/lib/route-utils"
import type { Route } from "@/lib/types"

interface PharmacyMapProps {
  deliveries: Route[]
}

export default function PharmacyMap({ deliveries }: PharmacyMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const routeLinesRef = useRef<Map<number, L.Polyline>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView([33.7175, -117.8311], 12)
    mapRef.current = map

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
      routeLinesRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return

    // Clear existing route lines
    routeLinesRef.current.forEach((line) => mapRef.current?.removeLayer(line))
    routeLinesRef.current.clear()

    // Draw delivery routes
    deliveries.forEach((delivery) => {
      const stops = delivery.stops.map((stop) => ({
        lat: stop.coordinates.pickup.lat,
        lng: stop.coordinates.pickup.lng,
      }))

      // Add final dropoff
      if (delivery.stops.length > 0) {
        const lastStop = delivery.stops[delivery.stops.length - 1]
        stops.push({
          lat: lastStop.coordinates.dropoff.lat,
          lng: lastStop.coordinates.dropoff.lng,
        })
      }

      const getPriorityColor = (priority: string) => {
        switch (priority) {
          case "urgent":
            return "#ef4444"
          case "high":
            return "#f97316"
          case "medium":
            return "#3b82f6"
          case "low":
            return "#6b7280"
          default:
            return "#6b7280"
        }
      }

      const color = getPriorityColor(delivery.priority)

      // Generate street-following path
      const streetPath = generateMultiStopStreetPath(stops)

      // Draw route line
      const routeLine = L.polyline(streetPath, {
        color: color,
        weight: 4,
        opacity: 0.7,
        dashArray: delivery.status === "pending" ? "10, 10" : undefined,
      }).addTo(mapRef.current!)

      routeLine.bindPopup(`
        <div class="p-2">
          <p class="font-medium">${delivery.name}</p>
          <p class="text-xs text-gray-600">Driver: ${delivery.assignedDriverName}</p>
          <p class="text-xs text-gray-600">${delivery.stops.length} stop(s)</p>
          <p class="text-xs mt-1">
            <span class="inline-block px-2 py-0.5 rounded text-white" style="background-color: ${color}">
              ${delivery.priority.toUpperCase()}
            </span>
          </p>
        </div>
      `)

      routeLinesRef.current.set(delivery.id, routeLine)

      // Add markers for pickup and dropoff
      stops.forEach((stop, index) => {
        const isFirst = index === 0
        const isLast = index === stops.length - 1

        const stopIcon = L.divIcon({
          className: "custom-stop-marker",
          html: `
            <div style="
              background: ${isFirst ? "#10b981" : isLast ? "#ef4444" : color};
              border: 2px solid white;
              border-radius: 50%;
              width: 16px;
              height: 16px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })

        L.marker([stop.lat, stop.lng], { icon: stopIcon })
          .addTo(mapRef.current!)
          .bindPopup(`
            <div class="p-2">
              <p class="text-xs font-medium">${delivery.name}</p>
              <p class="text-xs text-gray-600">
                ${isFirst ? "Pickup" : isLast ? "Delivery" : `Stop ${index}`}
              </p>
            </div>
          `)
      })
    })

    // Fit map to show all routes
    if (deliveries.length > 0) {
      const allPoints: [number, number][] = []
      deliveries.forEach((delivery) => {
        delivery.stops.forEach((stop) => {
          allPoints.push([stop.coordinates.pickup.lat, stop.coordinates.pickup.lng])
          allPoints.push([stop.coordinates.dropoff.lat, stop.coordinates.dropoff.lng])
        })
      })
      if (allPoints.length > 0) {
        mapRef.current.fitBounds(allPoints, { padding: [50, 50] })
      }
    }
  }, [deliveries])

  return <div ref={containerRef} className="h-[400px] w-full rounded-lg" />
}

"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { generateMultiStopStreetPath } from "@/lib/route-utils"

interface Driver {
  id: number
  name: string
  avatar: string
  progress: string
  location: { lat: number; lng: number }
  status: "active" | "paused" | "inactive"
}

interface Route {
  id: number
  name: string
  stops: number
  priority: string
  status: string
}

interface AdminMapProps {
  drivers: Driver[]
  routes?: Route[]
}

export default function AdminMap({ drivers, routes = [] }: AdminMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<number, L.Marker>>(new Map())
  const pathsRef = useRef<Map<number, L.Polyline>>(new Map())
  const pathCoordsRef = useRef<Map<number, [number, number][]>>(new Map())
  const routeLinesRef = useRef<Map<number, L.Polyline>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  const routeCoordinates = [
    {
      id: 1,
      stops: [
        { lat: 33.7175, lng: -117.8311 },
        { lat: 33.7456, lng: -117.8678 },
        { lat: 33.7123, lng: -117.8901 },
      ],
    },
    {
      id: 2,
      stops: [
        { lat: 33.7456, lng: -117.8678 },
        { lat: 33.7789, lng: -117.8234 },
        { lat: 33.7234, lng: -117.8567 },
        { lat: 33.7567, lng: -117.8123 },
        { lat: 33.789, lng: -117.8456 },
      ],
    },
    {
      id: 3,
      stops: [
        { lat: 33.689, lng: -117.8234 },
        { lat: 33.6567, lng: -117.8567 },
        { lat: 33.6234, lng: -117.889 },
        { lat: 33.6789, lng: -117.8123 },
      ],
    },
  ]

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    if (mapRef.current) {
      return
    }

    try {
      const map = L.map(containerRef.current, {
        tap: true,
        touchZoom: true,
        dragging: true,
        zoomControl: true,
      }).setView([33.7175, -117.8311], 12)

      mapRef.current = map

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      const style = document.createElement("style")
      style.textContent = `
        @keyframes pulse-green {
          0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
          50% { opacity: 0.5; transform: translateX(-50%) scale(1.2); }
        }
        @keyframes pulse-yellow {
          0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
          50% { opacity: 0.5; transform: translateX(-50%) scale(1.2); }
        }
      `
      document.head.appendChild(style)

      return () => {
        map.remove()
        mapRef.current = null
        markersRef.current.clear()
        pathsRef.current.clear()
        pathCoordsRef.current.clear()
        routeLinesRef.current.clear()
        document.head.removeChild(style)
      }
    } catch (error) {
      console.error("Error initializing map:", error)
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return

    // Clear existing route lines
    routeLinesRef.current.forEach((line) => mapRef.current?.removeLayer(line))
    routeLinesRef.current.clear()

    // Draw routes
    routeCoordinates.forEach((routeData) => {
      const route = routes.find((r) => r.id === routeData.id)
      if (!route) return

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

      const color = getPriorityColor(route.priority)

      const streetPath = generateMultiStopStreetPath(routeData.stops)

      // Draw route line following streets
      const routeLine = L.polyline(streetPath, {
        color: color,
        weight: 4,
        opacity: 0.7,
        dashArray: route.status === "pending" ? "10, 10" : undefined,
      }).addTo(mapRef.current!)

      routeLine.bindPopup(`
        <div class="p-2">
          <p class="font-medium">${route.name}</p>
          <p class="text-xs text-gray-600">${route.stops} stops</p>
          <p class="text-xs mt-1">
            <span class="inline-block px-2 py-0.5 rounded text-white" style="background-color: ${color}">
              ${route.priority.toUpperCase()}
            </span>
          </p>
        </div>
      `)

      routeLinesRef.current.set(route.id, routeLine)

      // Add markers for stops
      routeData.stops.forEach((stop, index) => {
        const isFirst = index === 0
        const isLast = index === routeData.stops.length - 1

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
              <p class="text-xs font-medium">${route.name}</p>
              <p class="text-xs text-gray-600">
                ${isFirst ? "Pickup" : isLast ? "Final Delivery" : `Stop ${index}`}
              </p>
            </div>
          `)
      })
    })
  }, [routes])

  useEffect(() => {
    if (!mapRef.current) return

    drivers.forEach((driver) => {
      if (driver.status === "inactive") {
        const marker = markersRef.current.get(driver.id)
        const path = pathsRef.current.get(driver.id)
        if (marker) {
          mapRef.current?.removeLayer(marker)
          markersRef.current.delete(driver.id)
        }
        if (path) {
          mapRef.current?.removeLayer(path)
          pathsRef.current.delete(driver.id)
        }
        pathCoordsRef.current.delete(driver.id)
        return
      }

      let marker = markersRef.current.get(driver.id)
      let path = pathsRef.current.get(driver.id)

      const color = driver.status === "active" ? "#10b981" : "#f59e0b"
      const animation = driver.status === "active" ? "pulse-green" : "pulse-yellow"

      const driverIcon = L.divIcon({
        className: "custom-driver-marker",
        html: `
          <div style="position: relative; width: 40px; height: 40px;">
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: ${color};
              border: 3px solid white;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            ">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M18 18.5a1.5 1.5 0 0 1-1 1.5 1.5 1.5 0 0 1-1.5-1.5 1.5 1.5 0 0 1 1.5-1.5 1.5 1.5 0 0 1 1 1.5zm1.5-9l1.96 2.5H17V9.5m-11 9A1.5 1.5 0 0 1 4.5 17 1.5 1.5 0 0 1 6 15.5 1.5 1.5 0 0 1 7.5 17 1.5 1.5 0 0 1 6 18.5M20 8h-3V4H3c-1.11 0-2 .89-2 2v11h2a3 3 0 0 0 3 3 3 3 0 0 0 3-3h6a3 3 0 0 0 3 3 3 3 0 0 0 3-3h2v-5l-3-4z"/>
              </svg>
            </div>
            <div style="
              position: absolute;
              top: -8px;
              left: 50%;
              transform: translateX(-50%);
              background: ${color}33;
              border-radius: 50%;
              width: 56px;
              height: 56px;
              animation: ${animation} 2s infinite;
            "></div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      })

      if (!marker) {
        marker = L.marker([driver.location.lat, driver.location.lng], { icon: driverIcon }).addTo(mapRef.current!)
        markersRef.current.set(driver.id, marker)
      } else {
        marker.setLatLng([driver.location.lat, driver.location.lng])
        marker.setIcon(driverIcon)
      }

      marker.bindPopup(`
        <div class="p-2">
          <p class="font-medium">${driver.name}</p>
          <p class="text-xs text-gray-600">${driver.progress}</p>
          <p class="text-xs mt-1">
            <span class="inline-block w-2 h-2 rounded-full ${driver.status === "active" ? "bg-green-500" : "bg-yellow-500"}"></span>
            <span class="ml-1">${driver.status === "active" ? "Active" : "On Break"}</span>
          </p>
        </div>
      `)

      if (!path) {
        path = L.polyline([], {
          color: color,
          weight: 3,
          opacity: 0.6,
          dashArray: "8, 8",
        }).addTo(mapRef.current!)
        pathsRef.current.set(driver.id, path)
      } else {
        path.setStyle({ color: color })
      }

      // Update path coordinates
      const coords = pathCoordsRef.current.get(driver.id) || []
      coords.push([driver.location.lat, driver.location.lng])
      // Keep only last 15 points
      const newCoords = coords.slice(-15)
      pathCoordsRef.current.set(driver.id, newCoords)
      path.setLatLngs(newCoords)
    })
  }, [drivers])

  return <div ref={containerRef} className="h-full w-full rounded-lg" />
}

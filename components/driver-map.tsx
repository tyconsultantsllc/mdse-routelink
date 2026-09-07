"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface DriverMapProps {
  center: { lat: number; lng: number }
  previewStops?: { lat: number; lng: number; label: string; type: "pickup" | "dropoff" }[]
}

export default function DriverMap({ center, previewStops = [] }: DriverMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const pathRef = useRef<L.Polyline | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const previewLayersRef = useRef<L.Layer[]>([])
  const [pathCoords, setPathCoords] = useState<[number, number][]>([])
  const [speed, setSpeed] = useState(0)
  const [heading, setHeading] = useState(0)
  const lastUpdateTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Initialize map
    const map = L.map(containerRef.current).setView([center.lat, center.lng], 13)
    mapRef.current = map

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    const truckIcon = L.divIcon({
      className: "custom-truck-marker",
      html: `
        <div style="position: relative; width: 40px; height: 40px;">
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
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
            background: rgba(59, 130, 246, 0.2);
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: pulse 2s infinite;
          "></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    })

    // Add marker with custom icon
    const marker = L.marker([center.lat, center.lng], { icon: truckIcon }).addTo(map)
    marker
      .bindPopup(`
      <div class="p-2">
        <p class="font-medium">Current Location</p>
        <p class="text-xs text-gray-600">Speed: <span id="speed">0</span> mph</p>
        <p class="text-xs text-gray-600">Heading: <span id="heading">0</span>°</p>
      </div>
    `)
      .openPopup()
    markerRef.current = marker

    const path = L.polyline([], {
      color: "#3b82f6",
      weight: 4,
      opacity: 0.7,
      dashArray: "10, 10",
    }).addTo(map)
    pathRef.current = path

    // Add CSS for pulse animation
    const style = document.createElement("style")
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
        50% { opacity: 0.5; transform: translateX(-50%) scale(1.2); }
      }
    `
    document.head.appendChild(style)

    return () => {
      map.remove()
      mapRef.current = null
      document.head.removeChild(style)
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return

    previewLayersRef.current.forEach((layer) => mapRef.current?.removeLayer(layer))
    previewLayersRef.current = []

    if (previewStops.length === 0) return

    const points: [number, number][] = previewStops.map((s) => [s.lat, s.lng])

    const line = L.polyline(points, { color: "#6366f1", weight: 3, opacity: 0.6, dashArray: "6, 8" }).addTo(
      mapRef.current,
    )
    previewLayersRef.current.push(line)

    previewStops.forEach((stop) => {
      const icon = L.divIcon({
        className: "custom-stop-marker",
        html: `
          <div style="
            background: ${stop.type === "pickup" ? "#3b82f6" : "#10b981"};
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
      const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(mapRef.current!)
      marker.bindPopup(`<strong>${stop.type === "pickup" ? "Pickup" : "Dropoff"}</strong><br/>${stop.label}`)
      previewLayersRef.current.push(marker)
    })
  }, [previewStops])

  useEffect(() => {
    if (markerRef.current && mapRef.current) {
      const oldPos = markerRef.current.getLatLng()
      const newPos = L.latLng(center.lat, center.lng)

      const distance = oldPos.distanceTo(newPos) // meters
      const now = Date.now()
      const isFirstRealUpdate = lastUpdateTimeRef.current === null

      if (distance < 10) return

      // The marker starts at a fallback default position before the first
      // real GPS reading arrives. That first update is the marker snapping
      // away from a fake starting point, not real movement - treating it as
      // "distance traveled in 30 seconds" produced physically impossible
      // speeds (e.g. 180,000+ mph) whenever the real position was far from
      // the fallback. Skip speed/heading for that one jump, then start
      // timing real elapsed time between updates from here on.
      if (isFirstRealUpdate) {
        lastUpdateTimeRef.current = now
        markerRef.current.setLatLng([center.lat, center.lng])
        return
      }

      const elapsedSeconds = Math.max((now - lastUpdateTimeRef.current!) / 1000, 1)
      lastUpdateTimeRef.current = now

      const calculatedSpeed = Math.round((distance / elapsedSeconds) * 2.237)
      setSpeed(calculatedSpeed)

      const lat1 = (oldPos.lat * Math.PI) / 180
      const lat2 = (newPos.lat * Math.PI) / 180
      const dLon = ((newPos.lng - oldPos.lng) * Math.PI) / 180
      const y = Math.sin(dLon) * Math.cos(lat2)
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
      const bearing = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360)
      setHeading(bearing)

      markerRef.current.setLatLng([center.lat, center.lng])
      markerRef.current.bindPopup(`
        <div class="p-2">
          <p class="font-medium">Current Location</p>
          <p class="text-xs text-gray-600">Speed: ${calculatedSpeed} mph</p>
          <p class="text-xs text-gray-600">Heading: ${bearing}°</p>
        </div>
      `)
      mapRef.current.panTo([center.lat, center.lng])

      // Position now comes from the real Geolocation API, so consecutive
      // points already trace the driver's actual path — no need to fabricate
      // a synthetic street-grid path between them.
      setPathCoords((prev) => [...prev, [center.lat, center.lng] as [number, number]].slice(-50))
    }
  }, [center])

  useEffect(() => {
    if (pathRef.current && pathCoords.length > 0) {
      pathRef.current.setLatLngs(pathCoords)
    }
  }, [pathCoords])

  return <div ref={containerRef} className="h-[400px] w-full rounded-lg" />
}

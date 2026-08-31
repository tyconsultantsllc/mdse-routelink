"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface Stop {
  id: number
  name: string
  address: string
  arrival: string
  departure: string
  status: "completed" | "in-progress" | "pending"
}

interface TrackingMapProps {
  center: { lat: number; lng: number }
  zoom: number
  stops: Stop[]
}

export default function TrackingMap({ center, zoom, stops }: TrackingMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Initialize map
    const map = L.map(mapContainerRef.current).setView([center.lat, center.lng], zoom)

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    // Create custom icon
    const driverIcon = L.divIcon({
      className: "custom-driver-marker",
      html: `
        <div style="
          width: 40px;
          height: 40px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    })

    // Add driver marker
    const marker = L.marker([center.lat, center.lng], {
      icon: driverIcon,
    }).addTo(map)

    marker.bindPopup("<b>Current Location</b><br>Driver is here")

    mapRef.current = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  // Update marker position when center changes
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([center.lat, center.lng])
      if (mapRef.current) {
        mapRef.current.panTo([center.lat, center.lng])
      }
    }
  }, [center])

  return <div ref={mapContainerRef} className="w-full h-full" />
}

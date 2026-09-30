"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface DriverLocationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  driverName: string
  latitude: number | null
  longitude: number | null
  lastUpdate: string | null
}

export function DriverLocationModal({
  open,
  onOpenChange,
  driverName,
  latitude,
  longitude,
  lastUpdate,
}: DriverLocationModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!open || !containerRef.current || latitude == null || longitude == null) return

    let cancelled = false

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return

      const map = L.map(containerRef.current).setView([latitude, longitude], 14)
      mapRef.current = map

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      L.marker([latitude, longitude]).addTo(map).bindPopup(driverName).openPopup()
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [open, latitude, longitude, driverName])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{driverName}'s Location</DialogTitle>
        </DialogHeader>
        {latitude == null || longitude == null ? (
          <div className="h-80 flex items-center justify-center text-sm text-muted-foreground text-center px-6">
            No location data yet — this driver hasn't started GPS tracking (happens automatically once they clock in
            to a route).
          </div>
        ) : (
          <>
            {/* Height set inline, not via Tailwind's h-80: once Leaflet adds
                its own "leaflet-container" class to this element, leaflet.css's
                un-layered `height: 100%` rule beats any Tailwind (layered)
                height class regardless of source order, collapsing this to
                0px with no sized ancestor to fill. Inline style always wins. */}
            {/* `isolate` gives this its own stacking context - see
                admin-map.tsx for why: without it, Leaflet's internal panes
                (z-index up to 700) aren't contained to this box and can
                render above unrelated fixed-position UI elsewhere on the
                page, including this same dialog's own overlay. */}
            <div ref={containerRef} className="w-full rounded-md isolate" style={{ height: 320 }} />
            {lastUpdate && (
              <p className="text-xs text-muted-foreground text-center">
                Last updated {new Date(lastUpdate).toLocaleString()}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

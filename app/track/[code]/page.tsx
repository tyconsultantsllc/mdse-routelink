"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Package, CheckCircle2, Truck, XCircle, RotateCcw, Clock } from 'lucide-react'

const DriverMap = dynamic(() => import("@/components/driver-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[280px] flex items-center justify-center bg-muted rounded-lg">
      <p className="text-muted-foreground text-sm">Loading map...</p>
    </div>
  ),
})

type TrackingInfo = {
  pharmacyName: string
  status: "pending" | "picked_up" | "delivered" | "failed" | "returned"
  routeStatus: string
  stopsAhead: number
  driverFirstName: string | null
  driverLocation: { latitude: number; longitude: number; updatedAt: string } | null
  deliveredAt: string | null
}

const STEPS: Array<{ key: TrackingInfo["status"]; label: string; icon: any }> = [
  { key: "pending", label: "Preparing", icon: Package },
  { key: "picked_up", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
]

export default function TrackingPage() {
  const params = useParams()
  const code = params.code as string

  const [info, setInfo] = useState<TrackingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    try {
      const { getPublicTrackingInfo } = await import("@/app/actions/data-actions")
      const result = await getPublicTrackingInfo(code)
      if (!result) {
        setNotFound(true)
      } else {
        setInfo(result as TrackingInfo)
      }
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [code])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!info || info.status === "delivered" || info.status === "failed" || info.status === "returned") return
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [info, load])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Loading your delivery status...</p>
      </div>
    )
  }

  if (notFound || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="text-center max-w-sm">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-lg font-semibold mb-2">Tracking link not available</h1>
          <p className="text-sm text-muted-foreground">
            This link may have expired, or the pharmacy has tracking turned off for this delivery. Please contact
            your pharmacy for the latest status.
          </p>
        </div>
      </div>
    )
  }

  const isFailedOrReturned = info.status === "failed" || info.status === "returned"
  const activeStepIndex = STEPS.findIndex((s) => s.key === info.status)

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">Delivery from</p>
          <h1 className="text-xl font-semibold">{info.pharmacyName}</h1>
        </div>

        <div className="bg-card border rounded-xl p-5">
          {isFailedOrReturned ? (
            <div className="flex flex-col items-center text-center gap-2 py-2">
              {info.status === "failed" ? (
                <XCircle className="h-10 w-10 text-red-500" />
              ) : (
                <RotateCcw className="h-10 w-10 text-purple-500" />
              )}
              <p className="font-medium">
                {info.status === "failed" ? "Delivery Attempt Unsuccessful" : "Returned to Pharmacy"}
              </p>
              <p className="text-sm text-muted-foreground">
                Please contact {info.pharmacyName} to arrange redelivery or pickup.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              {STEPS.map((step, i) => {
                const Icon = step.icon
                const isActive = i === activeStepIndex
                const isComplete = i < activeStepIndex || info.status === "delivered"
                return (
                  <div key={step.key} className="flex-1 flex flex-col items-center gap-1.5 relative">
                    {i > 0 && (
                      <div
                        className={`absolute top-4 right-1/2 w-full h-0.5 -z-10 ${
                          i <= activeStepIndex ? "bg-primary" : "bg-border"
                        }`}
                      />
                    )}
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        isComplete || isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={`text-xs text-center ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {info.status === "picked_up" && (
          <div className="bg-card border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-primary" />
              <span>
                {info.driverFirstName ? `${info.driverFirstName} is` : "Your driver is"} on the way
                {info.stopsAhead > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    - {info.stopsAhead} {info.stopsAhead === 1 ? "delivery" : "deliveries"} ahead of yours
                  </span>
                )}
              </span>
            </div>
            {info.driverLocation && (
              <DriverMap center={{ lat: info.driverLocation.latitude, lng: info.driverLocation.longitude }} />
            )}
          </div>
        )}

        {info.status === "pending" && (
          <div className="bg-card border rounded-xl p-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Your delivery is being prepared and will be on its way soon.
          </div>
        )}

        {info.status === "delivered" && (
          <div className="bg-card border rounded-xl p-5 flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>
              Delivered
              {info.deliveredAt &&
                ` on ${new Date(info.deliveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${new Date(
                  info.deliveredAt,
                ).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

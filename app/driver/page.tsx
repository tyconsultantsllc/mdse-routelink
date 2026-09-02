"use client"

import { useState, useEffect } from "react"
import { Truck, MapPin, Clock, Navigation, Camera, FileText, Activity, CheckCircle, LogOut } from 'lucide-react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { DeliveryConfirmationModal, type DeliveryConfirmationData } from "@/components/delivery-confirmation-modal"
import { useToast } from "@/hooks/use-toast"
import dynamic from "next/dynamic"
import { useRouter } from 'next/navigation'
import { createClient } from "@/lib/supabase/client"
import { confirmDeliveryStop, completeRoute as completeRouteAction, startStop, updateDriverLocation } from "@/lib/driver-actions"

const DriverMap = dynamic(() => import("@/components/driver-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex items-center justify-center bg-muted rounded-lg">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  ),
})

interface RouteStop {
  id: number
  pharmacyId: string
  pharmacyName: string
  pickupAddress: string
  dropoffAddress: string
  estimatedTime: number
  arrival?: string
  departure?: string
  status: "completed" | "pending" | "in-progress"
}

interface Route {
  id: number
  name: string
  priority: "low" | "medium" | "high" | "urgent"
  status: "pending" | "in-progress" | "completed"
  startTime: string
  endTime: string
  stops: RouteStop[]
}

export default function DriverTrackingPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [currentLocation, setCurrentLocation] = useState({ lat: 33.7175, lng: -117.8311 })
  const [isTracking, setIsTracking] = useState(false)
  const [speed, setSpeed] = useState(0)
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false)
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [driverId, setDriverId] = useState<string | null>(null)

  useEffect(() => {
    fetchDriverRoutes()
  }, [])

  const fetchDriverRoutes = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      setDriverId(user.id)

      const { data, error } = await supabase
        .from("routes")
        .select("*, route_stops(*, pharmacies(name, address))")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false })
        .order("stop_order", { foreignTable: "route_stops", ascending: true })

      if (error) throw error

      setRoutes(
        data?.map((r: any) => ({
          id: r.id,
          name: r.name || "Unnamed Route",
          priority: r.priority || "medium",
          status: r.status || "pending",
          startTime: r.scheduled_start
            ? new Date(r.scheduled_start).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "N/A",
          endTime: r.scheduled_end
            ? new Date(r.scheduled_end).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "N/A",
          stops:
            r.route_stops?.map((stop: any) => ({
              id: stop.id,
              pharmacyId: stop.pharmacy_id,
              pharmacyName: stop.pharmacies?.name || "Unknown Pharmacy",
              pickupAddress: stop.pharmacies?.address || "N/A",
              dropoffAddress: stop.delivery_address || "N/A",
              estimatedTime: stop.estimated_time || 30,
              // DB uses pending/picked_up/delivered/failed; UI uses pending/in-progress/completed
              status:
                stop.status === "delivered"
                  ? "completed"
                  : stop.status === "picked_up"
                    ? "in-progress"
                    : "pending",
            })) || [],
        })) || []
      )
    } catch (error) {
      console.error("Error fetching driver routes:", error)
      toast({
        title: "Error",
        description: "Failed to load routes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDelivery = (route: Route, stop: RouteStop) => {
    setSelectedRoute(route)
    setSelectedStop(stop)
    setConfirmationModalOpen(true)
  }

  const handleStartStop = async (route: Route, stop: RouteStop) => {
    try {
      const isFirstStopOnRoute = route.status === "pending"
      await startStop(route.id, stop.id, isFirstStopOnRoute)

      setRoutes((prev) =>
        prev.map((r) =>
          r.id === route.id
            ? {
                ...r,
                status: isFirstStopOnRoute ? ("in-progress" as const) : r.status,
                stops: r.stops.map((s) =>
                  s.id === stop.id
                    ? {
                        ...s,
                        status: "in-progress" as const,
                        arrival: new Date().toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      }
                    : s,
                ),
              }
            : r,
        ),
      )

      toast({
        title: "Stop Started",
        description: `Heading to ${stop.pharmacyName}`,
      })
    } catch (error) {
      console.error("Error starting stop:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start stop",
        variant: "destructive",
      })
    }
  }

  const handleCompleteRoute = async (routeId: number) => {
    try {
      await completeRouteAction(routeId)

      setRoutes((prev) =>
        prev.map((r) =>
          r.id === routeId
            ? {
                ...r,
                status: "completed" as const,
              }
            : r,
        ),
      )

      toast({
        title: "Route Completed",
        description: `Successfully completed route`,
      })
    } catch (error) {
      console.error("Error completing route:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete route",
        variant: "destructive",
      })
    }
  }

  const handleDeliveryConfirmed = async (data: DeliveryConfirmationData) => {
    if (!selectedStop || !selectedRoute || !driverId) return

    try {
      await confirmDeliveryStop({
        stopId: selectedStop.id,
        routeId: selectedRoute.id,
        pharmacyId: selectedStop.pharmacyId,
        driverId,
        recipientName: data.recipientName,
        notes: data.notes,
        signatureDataUrl: data.signature,
      })

      setRoutes((prev) =>
        prev.map((route) =>
          route.id === selectedRoute.id
            ? {
                ...route,
                stops: route.stops.map((s) =>
                  s.id === selectedStop.id
                    ? {
                        ...s,
                        status: "completed" as const,
                        departure: new Date().toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      }
                    : s,
                ),
              }
            : route,
        ),
      )

      toast({
        title: "Delivery Confirmed",
        description: `Successfully confirmed delivery to ${selectedStop.dropoffAddress}`,
      })
    } catch (error) {
      console.error("Error confirming delivery:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save delivery confirmation",
        variant: "destructive",
      })
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    localStorage.removeItem("pharmatrack_user")
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out",
    })
    router.push("/login")
  }

  useEffect(() => {
    if (!isTracking) return

    if (!("geolocation" in navigator)) {
      toast({
        title: "Location Unavailable",
        description: "This browser doesn't support GPS location.",
        variant: "destructive",
      })
      setIsTracking(false)
      return
    }

    let lastWriteAt = 0

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed: speedMps } = position.coords
        setCurrentLocation({ lat: latitude, lng: longitude })
        setSpeed(speedMps != null ? Math.round(speedMps * 2.237) : 0)

        // Throttle DB writes to roughly once every 15s regardless of how
        // often the browser reports a new position.
        const now = Date.now()
        if (driverId && now - lastWriteAt > 15000) {
          lastWriteAt = now
          updateDriverLocation(driverId, latitude, longitude).catch((err) =>
            console.error("Error saving driver location:", err),
          )
        }
      },
      (error) => {
        console.error("Geolocation error:", error)
        toast({
          title: "Location Error",
          description:
            error.code === error.PERMISSION_DENIED
              ? "Location access was denied. Enable it in your browser settings to track deliveries."
              : "Couldn't get your location. Check your device's GPS/location settings.",
          variant: "destructive",
        })
        setIsTracking(false)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [isTracking, driverId])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 hover:bg-red-100"
      case "high":
        return "bg-orange-100 text-orange-800 hover:bg-orange-100"
      case "medium":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100"
      case "low":
        return "bg-gray-100 text-gray-800 hover:bg-gray-100"
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100"
    }
  }

  const activeRoute = routes.find((r) => r.status === "in-progress")
  const nextStop = activeRoute?.stops.find((s) => s.status === "in-progress" || s.status === "pending")

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <nav className="bg-card shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 md:h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Truck className="text-primary h-6 w-6 md:h-8 md:w-8" />
                <span className="ml-2 text-lg md:text-xl font-bold text-foreground">MDSE RouteLink</span>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex items-center gap-2 px-2 md:px-3 py-1 rounded-full bg-muted">
                <Activity
                  className={`h-3 w-3 md:h-4 md:w-4 ${isTracking ? "text-green-500 animate-pulse" : "text-gray-400"}`}
                />
                <span className="text-xs md:text-sm font-medium">{isTracking ? "Active" : "Paused"}</span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9 md:h-10 md:w-10">
                      <LogOut className="h-4 w-4 md:h-5 md:w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Logout</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <div className="max-w-7xl mx-auto py-3 md:py-6 px-3 md:px-6 lg:px-8">
          <div className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 gap-4 md:gap-6">
              {/* Driver Dashboard - Full width on mobile */}
              <Card className="p-4 md:p-6">
                <h2 className="text-base md:text-lg font-medium text-foreground mb-4">Driver Dashboard</h2>
                <div className="flex justify-between items-center mb-4 md:mb-6">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Current Status</p>
                    <p className="text-lg md:text-xl font-bold text-foreground">
                      {isTracking ? "On Duty" : "Off Duty"}
                    </p>
                  </div>
                  <Button onClick={() => setIsTracking(!isTracking)} size="lg" className="min-h-[44px] min-w-[100px]">
                    {isTracking ? "Clock Out" : "Clock In"}
                  </Button>
                </div>
                {isTracking && (
                  <div className="mb-4 p-3 bg-primary/10 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Current Speed</p>
                        <p className="text-2xl font-bold text-primary">{speed} mph</p>
                      </div>
                      <Activity className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  {activeRoute && (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-between p-3 bg-muted rounded-md cursor-help">
                              <div>
                                <p className="text-sm text-muted-foreground">Active Route</p>
                                <p className="font-medium">{activeRoute.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {activeRoute.startTime} - {activeRoute.endTime}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge className={getPriorityColor(activeRoute.priority)}>
                                  {activeRoute.priority.charAt(0).toUpperCase() + activeRoute.priority.slice(1)}
                                </Badge>
                                <MapPin className="text-primary" />
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Your currently active delivery route</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {nextStop && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-between p-3 bg-muted rounded-md cursor-help">
                                <div>
                                  <p className="text-sm text-muted-foreground">Next Stop</p>
                                  <p className="font-medium">{nextStop.pharmacyName}</p>
                                  <p className="text-xs text-muted-foreground mt-1">Pickup: {nextStop.pickupAddress}</p>
                                  <p className="text-xs text-muted-foreground">Dropoff: {nextStop.dropoffAddress}</p>
                                </div>
                                <Clock className="text-primary" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Your next scheduled delivery stop</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </>
                  )}
                </div>
              </Card>

              <Card className="p-4 md:p-6">
                <h2 className="text-base md:text-lg font-medium text-foreground mb-4">Live Tracking</h2>
                <div className="h-[300px] md:h-[400px]">
                  <DriverMap center={currentLocation} />
                </div>
                <div className="mt-3 md:mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs md:text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Navigation className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                    <span>Updates every 15 seconds</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs">GPS: High Accuracy</span>
                  </div>
                </div>
              </Card>

              {/* Routes Section */}
              <Card className="p-3 md:p-6">
                <h2 className="text-base md:text-lg font-medium text-foreground mb-3 md:mb-4">My Routes</h2>
                <div className="space-y-4 md:space-y-6">
                  {routes.map((route) => {
                    const completedStops = route.stops.filter((s) => s.status === "completed").length
                    const totalStops = route.stops.length
                    const allStopsCompleted = completedStops === totalStops
                    const hasInProgressStop = route.stops.some((s) => s.status === "in-progress")
                    const nextPendingStop = route.stops.find((s) => s.status === "pending")

                    return (
                      <div key={route.id} className="border rounded-lg p-3 md:p-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 md:mb-4 gap-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm md:text-base text-foreground">{route.name}</h3>
                            <p className="text-xs md:text-sm text-muted-foreground">
                              {route.startTime} - {route.endTime} • {totalStops} stops
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getPriorityColor(route.priority)}>
                              {route.priority.charAt(0).toUpperCase() + route.priority.slice(1)}
                            </Badge>
                            <Badge
                              className={
                                route.status === "completed"
                                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                                  : route.status === "in-progress"
                                    ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                                    : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                              }
                            >
                              {route.status === "in-progress"
                                ? "In Progress"
                                : route.status.charAt(0).toUpperCase() + route.status.slice(1)}
                            </Badge>
                            {allStopsCompleted && route.status !== "completed" && (
                              <Button
                                size="default"
                                onClick={() => handleCompleteRoute(route.id)}
                                className="min-h-[44px]"
                              >
                                Complete Route
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {route.stops.map((stop, index) => (
                            <div
                              key={stop.id}
                              className={`p-3 rounded-md border ${
                                stop.status === "in-progress" ? "bg-blue-50 border-blue-200" : "bg-muted"
                              }`}
                            >
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs">
                                      Stop {index + 1}
                                    </Badge>
                                    <span className="font-medium text-xs md:text-sm">{stop.pharmacyName}</span>
                                    <Badge
                                      className={
                                        stop.status === "completed"
                                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                                          : stop.status === "in-progress"
                                            ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                                            : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                                      }
                                    >
                                      {stop.status === "in-progress"
                                        ? "In Progress"
                                        : stop.status.charAt(0).toUpperCase() + stop.status.slice(1)}
                                    </Badge>
                                  </div>
                                  <div className="text-xs md:text-sm space-y-2">
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="text-muted-foreground text-xs">Pickup</p>
                                        <p className="text-foreground">{stop.pickupAddress}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="text-muted-foreground text-xs">Dropoff</p>
                                        <p className="text-foreground">{stop.dropoffAddress}</p>
                                      </div>
                                    </div>
                                    {stop.arrival && (
                                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                        <Clock className="h-3 w-3 md:h-4 md:w-4" />
                                        <span>
                                          Arrived: {stop.arrival}
                                          {stop.departure && ` • Departed: ${stop.departure}`}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex md:flex-col gap-2">
                                  {stop.status === "pending" && !hasInProgressStop && stop.id === nextPendingStop?.id && (
                                    <Button
                                      size="lg"
                                      variant="outline"
                                      onClick={() => handleStartStop(route, stop)}
                                      className="min-h-[44px] flex-1 md:flex-none"
                                    >
                                      <Navigation className="mr-2 h-4 w-4" />
                                      Start
                                    </Button>
                                  )}
                                  {stop.status === "in-progress" && (
                                    <Button
                                      size="lg"
                                      onClick={() => handleConfirmDelivery(route, stop)}
                                      className="min-h-[44px] flex-1 md:flex-none"
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Confirm
                                    </Button>
                                  )}
                                  {stop.status === "completed" && (
                                    <div className="flex gap-2">
                                      <Button variant="ghost" size="icon" className="h-11 w-11">
                                        <Camera className="h-5 w-5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-11 w-11">
                                        <FileText className="h-5 w-5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-card border-t border-border">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground">
            &copy; 2023 MDSE RouteLink. All rights reserved.
          </p>
        </div>
      </footer>

      <DeliveryConfirmationModal
        open={confirmationModalOpen}
        onOpenChange={setConfirmationModalOpen}
        pharmacyName={selectedStop?.pharmacyName || ""}
        onConfirm={handleDeliveryConfirmed}
      />
    </div>
  )
}

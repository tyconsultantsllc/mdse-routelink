"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Package, Clock, CheckCircle, TrendingUp, LogOut, AlertCircle, Route as RouteIcon, Settings as SettingsIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from 'next/navigation'
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PharmacySettingsDialog } from "@/components/pharmacy-settings-dialog"
import { PharmacyPackItemsDialog } from "@/components/pharmacy-pack-items-dialog"
import { AddressWithUnit } from "@/components/address-with-unit"
import { RequestRouteDialog } from "@/components/request-route-dialog"
import { AnnouncementBanner } from "@/components/announcement-banner"
import { PharmacyReportModal } from "@/components/pharmacy-report-modal"
import { REGION_FALLBACK_COORDS, type Region } from "@/lib/region-utils"
import type { Route } from "@/lib/types"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"

// Dynamic import for pharmacy map component
const PharmacyMap = dynamic(() => import("@/components/pharmacy-map"), {
  ssr: false,
  loading: () => <div className="h-[300px] md:h-[400px] w-full rounded-lg bg-muted animate-pulse" />,
})

export default function PharmacyDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [pharmacyName, setPharmacyName] = useState("")
  const [pharmacyId, setPharmacyId] = useState("")
  const [trackingEnabled, setTrackingEnabled] = useState(false)
  const [barcodeScanningEnabled, setBarcodeScanningEnabled] = useState(false)
  const [packItemsRouteStopId, setPackItemsRouteStopId] = useState<number | null>(null)
  const [packItemsDeliveryName, setPackItemsDeliveryName] = useState("")
  const [userId, setUserId] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deliveries, setDeliveries] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [requestRouteOpen, setRequestRouteOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [myReports, setMyReports] = useState<any[]>([])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const name = localStorage.getItem("userName") || "Central Pharmacy"
      setPharmacyName(name)
    }

    fetchPharmacyDeliveries()

  }, [toast])

  const fetchPharmacyDeliveries = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      setUserId(user.id)
      setUserEmail(user.email || "")

      // Get pharmacy ID from pharmacy_users table
      const { data: pharmacyUser, error: pharmacyUserError } = await supabase
        .from("pharmacy_users")
        .select("pharmacy_id")
        .eq("id", user.id)
        .single()

      if (pharmacyUserError) throw pharmacyUserError

      setPharmacyId(pharmacyUser.pharmacy_id)

      const { data: reportsData } = await supabase
        .from("pharmacy_reports")
        .select("*")
        .eq("pharmacy_id", pharmacyUser.pharmacy_id)
        .order("created_at", { ascending: false })
      setMyReports(reportsData || [])

      // Fetch routes with stops at this pharmacy
      const { data, error } = await supabase
        .from("route_stops")
        .select("*, routes(*, drivers(*, users(first_name, last_name))), pharmacies(name, address, latitude, longitude, region, customer_tracking_enabled, barcode_scanning_enabled)")
        .eq("pharmacy_id", pharmacyUser.pharmacy_id)
        .order("created_at", { ascending: false })

      if (error) throw error

      if (data && data.length > 0) {
        setTrackingEnabled(!!data[0].pharmacies?.customer_tracking_enabled)
        setBarcodeScanningEnabled(!!data[0].pharmacies?.barcode_scanning_enabled)
      }

      // Transform to Route format
      const groupedRoutes = new Map()
      data?.forEach((stop: any) => {
        if (!groupedRoutes.has(stop.route_id)) {
          groupedRoutes.set(stop.route_id, {
            id: stop.route_id,
            name: stop.routes?.name || "Unnamed Route",
            assignedDriverId: stop.routes?.driver_id,
            assignedDriverName: stop.routes?.drivers
              ? `${stop.routes.drivers.users?.first_name} ${stop.routes.drivers.users?.last_name}`
              : "Unassigned",
            stops: [],
            // Fixed: routes has start_time/end_time, not scheduled_start/scheduled_end
            // (those columns don't exist - this always showed "N/A" before)
            startTime: stop.routes?.start_time
              ? new Date(stop.routes.start_time).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "N/A",
            endTime: stop.routes?.end_time
              ? new Date(stop.routes.end_time).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "N/A",
            estimatedDuration: stop.estimated_time || 30,
            priority: stop.routes?.priority || "medium",
            status: stop.routes?.status || "pending",
            driverConfirmation: stop.routes?.driver_confirmation || "pending",
            // total_distance was never a real column on routes - removed rather
            // than silently showing a number that was always undefined
            createdAt: stop.created_at,
            // Fixed: actual_end_time is the real column, not completed_at
            completedAt: stop.routes?.actual_end_time,
          })
        }

        groupedRoutes.get(stop.route_id).stops.push({
          id: stop.id,
          pharmacyId: stop.pharmacy_id,
          pharmacyName: stop.pharmacies?.name || "Unknown Pharmacy",
          pickupAddress: stop.pharmacies?.address || "N/A",
          // Fixed: the real column is dropoff_address, not delivery_address -
          // this always showed "N/A" to pharmacies before, same bug as the driver page
          dropoffAddress: stop.dropoff_address || "N/A",
          estimatedTime: stop.estimated_time || 30,
          // Fixed: the real column is stop_order, not sequence_order
          sequence: stop.stop_order,
          status: stop.status || "pending",
          // Real pharmacy coordinates (seeded pharmacies have these); dropoff
          // coordinates get filled in below via geocoding, since delivery
          // addresses are free text with no stored coordinates
          coordinates: {
            pickup: {
              lat: stop.pharmacies?.latitude || REGION_FALLBACK_COORDS[stop.pharmacies?.region as Region]?.lat || 39.8283,
              lng: stop.pharmacies?.longitude || REGION_FALLBACK_COORDS[stop.pharmacies?.region as Region]?.lng || -98.5795,
            },
            dropoff: null as { lat: number; lng: number } | null,
          },
          dropoffAddressRaw: stop.dropoff_address,
          trackingCode: stop.tracking_code,
        })
      })

      const routesArray = Array.from(groupedRoutes.values())

      // Geocode each stop's dropoff address. Previously every single stop
      // showed the exact same hardcoded coordinates regardless of the real
      // delivery address - the map was showing fiction, not data.
      const { geocodeAddress } = await import("@/lib/geocode")
      for (const route of routesArray) {
        for (const stop of route.stops) {
          if (stop.dropoffAddressRaw) {
            const coords = await geocodeAddress(stop.dropoffAddressRaw)
            if (coords) {
              stop.coordinates.dropoff = { lat: coords.lat, lng: coords.lng }
            }
          }
          if (!stop.coordinates.dropoff) {
            // Fallback if geocoding fails - same point as pickup rather than
            // a fixed unrelated location, so it's at least in the right area
            stop.coordinates.dropoff = { ...stop.coordinates.pickup }
          }
          delete stop.dropoffAddressRaw
        }
      }

      setDeliveries(routesArray)
    } catch (error) {
      console.error("Error fetching pharmacy deliveries:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account.",
      })
    } catch (error) {
      console.error("Sign out error:", error)
      toast({
        title: "Logged out",
        description: "Signed out locally - your session may still be active on the server.",
      })
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("userRole")
        localStorage.removeItem("userName")
        localStorage.removeItem("userEmail")
      }
      router.push("/auth/login")
    }
  }

  const incomingDeliveries = deliveries.filter((d) => d.status === "pending" || d.status === "in-progress")
  const completedDeliveries = deliveries.filter((d) => d.status === "completed")
  const inProgressCount = deliveries.filter((d) => d.status === "in-progress").length
  const todayCompletedCount = completedDeliveries.filter((d) => {
    const completedDate = new Date(d.completedAt || d.createdAt)
    const today = new Date()
    return completedDate.toDateString() === today.toDateString()
  }).length

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500"
      case "high":
        return "bg-orange-500"
      case "medium":
        return "bg-yellow-500"
      case "low":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending</Badge>
      case "in-progress":
        return <Badge className="bg-blue-500">In Progress</Badge>
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getConfirmationBadge = (confirmation: string) => {
    switch (confirmation) {
      case "confirmed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Driver Confirmed</Badge>
      case "declined":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Driver Declined</Badge>
      default:
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Awaiting Driver</Badge>
    }
  }

  const copyTrackingLink = (trackingCode: string) => {
    const url = `${window.location.origin}/track/${trackingCode}`
    navigator.clipboard.writeText(url)
    toast({ title: "Link copied", description: "Share it with your customer to let them track their delivery." })
  }

  const avgDeliveryTime =
    completedDeliveries.length > 0
      ? Math.round(completedDeliveries.reduce((sum, d) => sum + d.estimatedDuration, 0) / completedDeliveries.length)
      : 28

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background pb-16 md:pb-0">
        {/* Header - Mobile optimized */}
        <header className="border-b bg-card sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              <Package className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg md:text-2xl font-bold truncate">{pharmacyName}</h1>
                <p className="text-xs md:text-sm text-muted-foreground">Delivery Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setReportModalOpen(true)}
                    className="h-9 w-9 md:h-10 md:w-10 bg-transparent"
                  >
                    <AlertCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Contact Dispatch</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSettingsOpen(true)}
                    className="h-9 w-9 md:h-10 md:w-10 bg-transparent"
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleLogout}
                    className="h-9 w-9 md:h-10 md:w-10 bg-transparent"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Logout</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        <AnnouncementBanner />

        <div className="p-3 md:p-6 space-y-4 md:space-y-6">
          <Button onClick={() => setRequestRouteOpen(true)} className="w-full md:w-auto" size="lg">
            <RouteIcon className="h-4 w-4 mr-2" />
            Request a Route
          </Button>

          {/* Stats - Mobile optimized grid */}
          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Incoming Deliveries</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{incomingDeliveries.length}</div>
                <p className="text-xs text-muted-foreground">{inProgressCount} currently in progress</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayCompletedCount}</div>
                <p className="text-xs text-muted-foreground">Total: {completedDeliveries.length} all time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Delivery Time</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgDeliveryTime} min</div>
                <p className="text-xs text-muted-foreground">Based on completed deliveries</p>
              </CardContent>
            </Card>
          </div>

          {/* Incoming Deliveries */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Incoming Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:space-y-4">
                {incomingDeliveries.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No incoming deliveries</p>
                ) : (
                  incomingDeliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex flex-col md:flex-row md:items-start md:justify-between p-3 md:p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-3"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div
                            className={`w-2 h-2 rounded-full ${getPriorityColor(delivery.priority)} flex-shrink-0`}
                          />
                          <h3 className="font-semibold text-sm md:text-base">{delivery.name}</h3>
                          {getStatusBadge(delivery.status)}
                          {getConfirmationBadge(delivery.driverConfirmation || "pending")}
                        </div>
                        <div className="text-xs md:text-sm text-muted-foreground space-y-1">
                          <p>Driver: {delivery.assignedDriverName}</p>
                          <p className="break-words">Pickup: {delivery.stops[0].pickupAddress}</p>
                          <p className="break-words">
                            Dropoff: <AddressWithUnit address={delivery.stops[0].dropoffAddress} size="sm" />
                          </p>
                          <p>
                            Estimated Time: {delivery.startTime} - {delivery.endTime}
                          </p>
                        </div>
                      </div>
                      <div className="flex md:flex-col md:items-end justify-end gap-2">
                        <Badge variant="outline" className="capitalize text-xs">
                          {delivery.priority}
                        </Badge>
                        {trackingEnabled && delivery.stops[0]?.trackingCode && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 bg-transparent"
                            onClick={() => copyTrackingLink(delivery.stops[0].trackingCode!)}
                          >
                            Copy Tracking Link
                          </Button>
                        )}
                        {barcodeScanningEnabled && delivery.stops[0]?.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 bg-transparent"
                            onClick={() => {
                              setPackItemsRouteStopId(delivery.stops[0].id)
                              setPackItemsDeliveryName(delivery.name)
                            }}
                          >
                            Scan Packages
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Delivery Routes Map */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Delivery Routes Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] md:h-[400px]">
                <PharmacyMap deliveries={incomingDeliveries} />
              </div>
            </CardContent>
          </Card>

          {/* My Reports */}
          {myReports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg">My Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {myReports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-start justify-between gap-3 p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{report.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(report.created_at).toLocaleString()}
                        </p>
                      </div>
                      {report.status === "resolved" ? (
                        <Badge className="bg-green-500 shrink-0">Resolved</Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">
                          Open
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Completed Deliveries */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base md:text-lg">Recent Completed Deliveries</CardTitle>
              <Link href="/pharmacy/history">
                <Button variant="outline" size="sm">
                  View Full History
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:space-y-4">
                {completedDeliveries.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No completed deliveries</p>
                ) : (
                  completedDeliveries.slice(0, 5).map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex flex-col md:flex-row md:items-start md:justify-between p-3 md:p-4 border rounded-lg bg-muted/30 gap-3"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <h3 className="font-semibold text-sm md:text-base">{delivery.name}</h3>
                        </div>
                        <div className="text-xs md:text-sm text-muted-foreground space-y-1">
                          <p>Driver: {delivery.assignedDriverName}</p>
                          <p className="break-words">
                            Dropoff: <AddressWithUnit address={delivery.stops[0].dropoffAddress} size="sm" />
                          </p>
                          <p>Completed: {delivery.startTime}</p>
                        </div>
                      </div>
                      <Badge className="bg-green-500 w-fit text-xs">Completed</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {pharmacyId && userId && (
        <PharmacyReportModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          pharmacyId={pharmacyId}
          userId={userId}
          onSuccess={fetchPharmacyDeliveries}
        />
      )}
      <PharmacySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} userId={userId} userEmail={userEmail} />
      <PharmacyPackItemsDialog
        open={!!packItemsRouteStopId}
        onOpenChange={(open) => !open && setPackItemsRouteStopId(null)}
        routeStopId={packItemsRouteStopId}
        deliveryName={packItemsDeliveryName}
      />
      <RequestRouteDialog
        open={requestRouteOpen}
        onOpenChange={setRequestRouteOpen}
        onSubmitted={fetchPharmacyDeliveries}
      />
    </TooltipProvider>
  )
}

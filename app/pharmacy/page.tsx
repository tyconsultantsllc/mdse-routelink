"use client"

import { useState, useEffect } from "react"
import { Package, Clock, CheckCircle, TrendingUp, LogOut, Bell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from 'next/navigation'
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PharmacyNotificationSettings } from "@/components/pharmacy-notification-settings"
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
  const [deliveries, setDeliveries] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false)

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

      // Get pharmacy ID from pharmacy_users table
      const { data: pharmacyUser, error: pharmacyUserError } = await supabase
        .from("pharmacy_users")
        .select("pharmacy_id")
        .eq("id", user.id)
        .single()

      if (pharmacyUserError) throw pharmacyUserError

      // Fetch routes with stops at this pharmacy
      const { data, error } = await supabase
        .from("route_stops")
        .select("*, routes(*, drivers(*, users(first_name, last_name))), pharmacies(name, address)")
        .eq("pharmacy_id", pharmacyUser.pharmacy_id)
        .order("created_at", { ascending: false })

      if (error) throw error

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
            startTime: stop.routes?.scheduled_start
              ? new Date(stop.routes.scheduled_start).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "N/A",
            endTime: stop.routes?.scheduled_end
              ? new Date(stop.routes.scheduled_end).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "N/A",
            estimatedDuration: stop.estimated_time || 30,
            priority: stop.routes?.priority || "medium",
            status: stop.routes?.status || "pending",
            totalDistance: stop.routes?.total_distance || 0,
            createdAt: stop.created_at,
            completedAt: stop.routes?.completed_at,
          })
        }

        groupedRoutes.get(stop.route_id).stops.push({
          id: stop.id,
          pharmacyId: stop.pharmacy_id,
          pharmacyName: stop.pharmacies?.name || "Unknown Pharmacy",
          pickupAddress: stop.pharmacies?.address || "N/A",
          dropoffAddress: stop.delivery_address || "N/A",
          estimatedTime: stop.estimated_time || 30,
          sequence: stop.sequence_order,
          status: stop.status || "pending",
          coordinates: {
            pickup: { lat: 33.7175, lng: -117.8311 },
            dropoff: { lat: 33.6846, lng: -117.8265 },
          },
        })
      })

      setDeliveries(Array.from(groupedRoutes.values()))
    } catch (error) {
      console.error("Error fetching pharmacy deliveries:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("userRole")
      localStorage.removeItem("userName")
      localStorage.removeItem("userEmail")
    }
    toast({
      title: "Logged out successfully",
      description: "You have been logged out of your account.",
    })
    router.push("/auth/login")
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
              <Dialog open={notificationSettingsOpen} onOpenChange={setNotificationSettingsOpen}>
                <DialogTrigger asChild>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9 md:h-10 md:w-10 bg-transparent">
                        <Bell className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Notification Settings</TooltipContent>
                  </Tooltip>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Notification Settings</DialogTitle>
                    <DialogDescription>Manage how you receive delivery notifications</DialogDescription>
                  </DialogHeader>
                  <PharmacyNotificationSettings />
                </DialogContent>
              </Dialog>
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

        <div className="p-3 md:p-6 space-y-4 md:space-y-6">
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
                <p className="text-xs text-muted-foreground">5% faster than last week</p>
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
                        </div>
                        <div className="text-xs md:text-sm text-muted-foreground space-y-1">
                          <p>Driver: {delivery.assignedDriverName}</p>
                          <p className="break-words">Pickup: {delivery.stops[0].pickupAddress}</p>
                          <p className="break-words">Dropoff: {delivery.stops[0].dropoffAddress}</p>
                          <p>
                            Estimated Time: {delivery.startTime} - {delivery.endTime}
                          </p>
                        </div>
                      </div>
                      <div className="flex md:block justify-end">
                        <Badge variant="outline" className="capitalize text-xs">
                          {delivery.priority}
                        </Badge>
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

          {/* Recent Completed Deliveries */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Recent Completed Deliveries</CardTitle>
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
                          <p className="break-words">Dropoff: {delivery.stops[0].dropoffAddress}</p>
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
    </TooltipProvider>
  )
}

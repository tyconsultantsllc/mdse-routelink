"use client"

import { useState, useEffect } from "react"
import { Truck, CheckCircle, Clock } from 'lucide-react'
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import type { Notification } from "@/components/notification-center"
import { useToast } from "@/hooks/use-toast"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button" // Fixed import to use named export instead of default
import { createClient } from "@/lib/supabase/client"

const AdminMap = dynamic(() => import("@/components/admin-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-muted rounded-lg">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  ),
})

interface Driver {
  id: number
  name: string
  email: string
  avatar: string
  route: string
  status: "active" | "paused" | "inactive"
  statusText: string
  progress: string
  location: { lat: number; lng: number }
}

interface Route {
  id: number
  name: string
  priority: string
  startTime: string
  stops: number
  status: "in-progress" | "pending" | "completed"
}

export default function AdminDashboard() {
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [recentDeliveries, setRecentDeliveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [unassignedRoutes, setUnassignedRoutes] = useState<Route[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const { getDrivers, getUsers, getRoutes, getDeliveryLogs, getPharmacies } = await import("@/app/actions/data-actions")
      
      const [driversData, usersData, routesData, deliveriesData, pharmaciesData] = await Promise.all([
        getDrivers(),
        getUsers(),
        getRoutes(),
        getDeliveryLogs(),
        getPharmacies()
      ])

      const driverUsers = usersData.filter((u: any) => u.role === "driver")

      const driversWithUsers = driversData.map((d: any) => {
        const user = driverUsers.find((u: any) => u.id === d.id)
        const activeRoute = routesData.find((r: any) => 
          r.driver_id === d.id && r.status === 'in-progress'
        )
        return {
          ...d,
          name: user ? `${user.first_name} ${user.last_name}` : 'Unknown Driver',
          email: user?.email,
          hasActiveRoute: !!activeRoute,
          routeName: activeRoute?.name || 'No Active Route'
        }
      })

      const deliveriesWithDetails = deliveriesData.map((d: any) => {
        const driver = driversWithUsers.find((dr: any) => dr.id === d.driver_id)
        const pharmacy = pharmaciesData.find((p: any) => p.id === d.pharmacy_id)
        return {
          ...d,
          driver: driver?.name || 'Unknown Driver',
          pharmacy: pharmacy?.name || 'Unknown Pharmacy'
        }
      })

      const unassigned = routesData.filter((route: any) => !route.driver_id)
      setUnassignedRoutes(
        unassigned.map((route: any) => ({
          id: route.id,
          name: route.name,
          priority: route.priority || "medium",
          startTime: new Date(route.start_time).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          stops: 0,
          status: route.status,
        }))
      )

      const activeDriversList = driversWithUsers.filter((d: any) => d.hasActiveRoute)
      
      setDrivers(
        activeDriversList.map((d: any) => ({
          id: d.id,
          name: d.name,
          email: d.email || '',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.id}`,
          route: d.routeName,
          status: d.status || "inactive",
          statusText: "On time",
          progress: "0/0 stops",
          location: { lat: d.current_latitude || 33.7175, lng: d.current_longitude || -117.8311 },
        }))
      )

      setRoutes(routesData)
      setRecentDeliveries(
        deliveriesWithDetails.slice(0, 10).map((d: any) => ({
          id: d.id,
          driver: d.driver,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.driver_id}`,
          pharmacy: d.pharmacy,
          time: new Date(d.timestamp).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }))
      )
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Notification handlers
  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    toast({
      title: "All notifications marked as read",
      variant: "default",
    })
  }

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  useEffect(() => {
    if (unassignedRoutes.length > 0) {
      const urgentRoutes = unassignedRoutes.filter((r) => r.priority === "urgent")
      if (urgentRoutes.length > 0) {
        toast({
          title: "Urgent: Unassigned Routes",
          description: `${urgentRoutes.length} urgent route(s) need driver assignment`,
          variant: "destructive",
        })
      }
    }
  }, [unassignedRoutes, toast])

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

  const activeDriversCount = drivers.length
  const completedTodayCount = recentDeliveries.length
  const inProgressCount = 0

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar />

        <div className="flex flex-col flex-1 overflow-hidden pt-16 md:pt-0">
          <AdminHeader
            title="Admin Dashboard"
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onDismiss={handleDismiss}
          />

          <div className="flex-1 overflow-y-auto p-3 md:p-6">
            {/* Unassigned Routes Alert Banner */}
            {unassignedRoutes.length > 0 && (
              <Card className="p-3 md:p-4 mb-4 md:mb-6 bg-orange-50 border-orange-200">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex items-start gap-2 md:gap-3">
                    <div className="p-2 rounded-full bg-orange-100 flex-shrink-0">
                      <Clock className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm md:text-base text-orange-900">Unassigned Routes Alert</h3>
                      <p className="text-xs md:text-sm text-orange-700 mt-1">
                        {unassignedRoutes.length} route(s) need driver assignment
                      </p>
                      <div className="mt-2 md:mt-3 space-y-2">
                        {unassignedRoutes.map((route) => (
                          <div key={route.id} className="flex flex-wrap items-center gap-1 md:gap-2 text-xs md:text-sm">
                            <Badge className={getPriorityColor(route.priority)}>
                              {route.priority.charAt(0).toUpperCase() + route.priority.slice(1)}
                            </Badge>
                            <span className="font-medium">{route.name}</span>
                            <span className="text-muted-foreground">
                              • {route.stops} stops • {route.startTime}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="default"
                    onClick={() => (window.location.href = "/admin/routes")}
                    className="w-full md:w-auto min-h-[44px]"
                  >
                    Assign Drivers
                  </Button>
                </div>
              </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 mb-4 md:mb-6">
              <Card className="p-4 md:p-6">
                <div className="flex items-center">
                  <div className="p-2 md:p-3 rounded-full bg-primary/10 text-primary flex-shrink-0">
                    <Truck className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-xs md:text-sm font-medium text-muted-foreground">Active Drivers</p>
                    <p className="text-xl md:text-2xl font-bold text-foreground">{activeDriversCount}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 md:p-6">
                <div className="flex items-center">
                  <div className="p-2 md:p-3 rounded-full bg-green-100 text-green-600 flex-shrink-0">
                    <CheckCircle className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-xs md:text-sm font-medium text-muted-foreground">Completed Today</p>
                    <p className="text-xl md:text-2xl font-bold text-foreground">{completedTodayCount}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 md:p-6">
                <div className="flex items-center">
                  <div className="p-2 md:p-3 rounded-full bg-yellow-100 text-yellow-600 flex-shrink-0">
                    <Clock className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-xs md:text-sm font-medium text-muted-foreground">In Progress</p>
                    <p className="text-xl md:text-2xl font-bold text-foreground">{inProgressCount}</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 md:gap-6 mb-4 md:mb-6">
              {/* Map - Full width on mobile for better visibility */}
              <Card className="p-4 md:p-6">
                <h2 className="text-base md:text-lg font-medium text-foreground mb-3 md:mb-4">Live Driver Locations</h2>
                <div className="h-[300px] md:h-[400px]">
                  <AdminMap drivers={drivers} routes={routes} />
                </div>
              </Card>

              {/* Active Drivers - Full width on mobile */}
              <Card className="p-4 md:p-6">
                <h2 className="text-base md:text-lg font-medium text-foreground mb-3 md:mb-4">Active Drivers</h2>
                <div className="space-y-3 md:space-y-4">
                  {drivers.map((driver) => (
                    <div
                      key={driver.id}
                      className={`p-3 md:p-4 rounded-md bg-card shadow-sm border-l-4 ${
                        driver.status === "active"
                          ? "border-green-500"
                          : driver.status === "paused"
                            ? "border-yellow-500"
                            : "border-red-500"
                      }`}
                    >
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                          <AvatarImage src={driver.avatar || "/placeholder.svg"} />
                          <AvatarFallback>{driver.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="ml-3 flex-1 min-w-0">
                          <p className="text-sm md:text-base font-medium text-foreground truncate">{driver.name}</p>
                          <p className="text-xs md:text-sm text-muted-foreground truncate">Route: {driver.route}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-xs font-medium text-muted-foreground">{driver.statusText}</p>
                          {driver.progress && <p className="text-sm font-bold text-foreground">{driver.progress}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Recent Deliveries */}
            <Card className="overflow-hidden">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border">
                <h2 className="text-base md:text-lg font-medium text-foreground">Recent Deliveries</h2>
              </div>
              <div className="divide-y divide-border">
                {recentDeliveries.map((delivery) => (
                  <div key={delivery.id} className="px-4 md:px-6 py-3 md:py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center flex-1 min-w-0">
                        <Avatar className="h-9 w-9 md:h-10 md:w-10 flex-shrink-0">
                          <AvatarImage src={delivery.avatar || "/placeholder.svg"} />
                          <AvatarFallback>{delivery.driver[0]}</AvatarFallback>
                        </Avatar>
                        <div className="ml-3 md:ml-4 flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{delivery.driver}</p>
                          <p className="text-xs text-muted-foreground truncate">{delivery.pharmacy}</p>
                        </div>
                      </div>
                      <div className="flex flex-col md:flex-row items-end md:items-center gap-2 flex-shrink-0">
                        <span className="text-xs md:text-sm text-muted-foreground">{delivery.time}</span>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Completed</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

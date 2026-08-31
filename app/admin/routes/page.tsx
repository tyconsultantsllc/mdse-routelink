"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Edit, MapIcon, Trash2, AlertCircle, UserPlus } from 'lucide-react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { AddRouteModal } from "@/components/add-route-modal"
import { EditRouteModal } from "@/components/edit-route-modal"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import dynamic from "next/dynamic"
import { AssignDriverModal } from "@/components/assign-driver-modal"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { getRoutes, getUsers } from "@/app/actions/data-actions"

const RouteMap = dynamic(() => import("@/components/route-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-muted rounded-lg">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  ),
})

export default function RouteManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editRouteId, setEditRouteId] = useState<number | null>(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<{ id: number; name: string; driver?: string } | null>(null)
  const [deleteConfirmRoute, setDeleteConfirmRoute] = useState<{ id: number; name: string } | null>(null)
  const [highlightedRouteId, setHighlightedRouteId] = useState<number | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  const { toast } = useToast()

  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRoutes()
  }, [])

  const fetchRoutes = async () => {
    try {
      const [routesData, usersData] = await Promise.all([
        getRoutes(),
        getUsers()
      ])

      setRoutes(
        routesData?.map((r: any) => {
          const driver = usersData.find((u: any) => u.id === r.driver_id && u.role === "driver")
          return {
            id: r.id,
            name: r.name || "Unnamed Route",
            assignedDriver: driver
              ? `${driver.first_name} ${driver.last_name}`
              : null,
            avatar: driver
              ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.driver_id}`
              : null,
            stops: r.total_stops || 0,
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
            estimatedDuration: "N/A",
            distance: `${r.total_distance || 0} miles`,
            priority: r.priority || "medium",
            status: r.status || "pending",
          }
        }) || []
      )
    } catch (error) {
      console.error("Error fetching routes:", error)
      toast({
        title: "Error",
        description: "Failed to load routes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 hover:bg-green-100"
      case "in-progress":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100"
      case "pending":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100"
    }
  }

  const unassignedCount = routes.filter((r) => !r.assignedDriver).length

  const handleAssignDriver = (routeId: number, routeName: string, currentDriver?: string) => {
    setSelectedRoute({ id: routeId, name: routeName, driver: currentDriver })
    setAssignModalOpen(true)
  }

  const handleDriverAssigned = (driverId: string, driverName: string) => {
    console.log(`[v0] Assigned driver ${driverName} (${driverId}) to route ${selectedRoute?.id}`)
    fetchRoutes() // Refresh routes after assignment
  }

  const handleEditRoute = (routeId: number, routeName: string) => {
    console.log(`[v0] Editing route ${routeId}: ${routeName}`)
    setEditRouteId(routeId)
    setIsEditModalOpen(true)
  }

  const handleDeleteRoute = (routeId: number, routeName: string) => {
    console.log(`[v0] Delete requested for route ${routeId}: ${routeName}`)
    setDeleteConfirmRoute({ id: routeId, name: routeName })
  }

  const confirmDelete = async () => {
    if (deleteConfirmRoute) {
      toast({
        title: "Route Deleted",
        description: `${deleteConfirmRoute.name} has been removed from the system`,
        variant: "destructive",
      })
      fetchRoutes()
      setDeleteConfirmRoute(null)
    }
  }

  const handleViewOnMap = (routeId: number, routeName: string) => {
    console.log(`[v0] Viewing route ${routeId} on map: ${routeName}`)
    setHighlightedRouteId(routeId)
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    toast({
      title: "View on Map",
      description: `Highlighting ${routeName} on the map`,
    })
    setTimeout(() => setHighlightedRouteId(null), 3000)
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar />

        <div className="flex flex-col flex-1 overflow-hidden">
          <AdminHeader title="Route Management" />

          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Delivery Routes</h2>
                {unassignedCount > 0 && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-orange-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{unassignedCount} route(s) need driver assignment</span>
                  </div>
                )}
              </div>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Route
              </Button>
            </div>

            <Card className="p-6 mb-6" ref={mapRef}>
              <RouteMap highlightedRouteId={highlightedRouteId} routes={routes} />
            </Card>

            <Card className="overflow-hidden">
              {loading ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">Loading routes...</p>
                </Card>
              ) : routes.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No routes found. Add your first route to get started.</p>
                </Card>
              ) : (
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Route Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Assigned Driver
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Stops
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Time Window
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {routes.map((route) => (
                      <tr key={route.id} className={!route.assignedDriver ? "bg-orange-50/50" : ""}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">{route.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {route.distance} • {route.estimatedDuration}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {route.assignedDriver ? (
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={route.avatar || "/placeholder.svg"} />
                                <AvatarFallback>{route.assignedDriver[0]}</AvatarFallback>
                              </Avatar>
                              <span className="ml-2 text-sm text-foreground">{route.assignedDriver}</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAssignDriver(route.id, route.name)}
                              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                            >
                              <AlertCircle className="h-4 w-4 text-orange-600" />
                              <span className="text-sm text-orange-600 font-medium underline">Assign Driver</span>
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-foreground">{route.stops} stops</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-foreground">{route.startTime}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getPriorityColor(route.priority)}>
                            {route.priority.charAt(0).toUpperCase() + route.priority.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getStatusColor(route.status)}>
                            {route.status === "in-progress"
                              ? "In Progress"
                              : route.status.charAt(0).toUpperCase() + route.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {route.assignedDriver ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="mr-2"
                                  onClick={() => handleAssignDriver(route.id, route.name, route.assignedDriver)}
                                >
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Reassign driver</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="mr-2 text-orange-600"
                                  onClick={() => handleAssignDriver(route.id, route.name)}
                                >
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Assign driver</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="mr-2"
                                onClick={() => handleEditRoute(route.id, route.name)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit route details</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="mr-2"
                                onClick={() => handleViewOnMap(route.id, route.name)}
                              >
                                <MapIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View on map</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteRoute(route.id, route.name)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete route</TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>

        <AddRouteModal 
          open={isModalOpen} 
          onOpenChange={setIsModalOpen}
          onSuccess={fetchRoutes}
        />
        <EditRouteModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          routeId={editRouteId}
          onSuccess={fetchRoutes}
        />
        <AssignDriverModal
          open={assignModalOpen}
          onOpenChange={setAssignModalOpen}
          routeName={selectedRoute?.name || ""}
          routeId={selectedRoute?.id || 0}
          currentDriver={selectedRoute?.driver}
          onAssign={handleDriverAssigned}
        />

        <Dialog open={!!deleteConfirmRoute} onOpenChange={() => setDeleteConfirmRoute(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Route</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{deleteConfirmRoute?.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setDeleteConfirmRoute(null)}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

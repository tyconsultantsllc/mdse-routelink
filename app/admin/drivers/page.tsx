"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, MapIcon, Trash2, UserX, UserCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { RefreshButton } from "@/components/refresh-button"
import { AddUserModal } from "@/components/add-user-modal"
import { EditUserModal } from "@/components/edit-user-modal"
import { DriverLocationModal } from "@/components/driver-location-modal"
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getUsers } from "@/app/actions/data-actions"
import { RegionBadge } from "@/components/region-badge"
import { RegionFilter } from "@/components/region-filter"
import { getDriverDetails } from "@/lib/region-utils"

export default function DriverManagement() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<any>(null)
  const [viewingLocationDriver, setViewingLocationDriver] = useState<any>(null)
  const { toast } = useToast()
  const [drivers, setDrivers] = useState<any[]>([])
  const [selectedRegion, setSelectedRegion] = useState("all")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchDrivers()

    const interval = setInterval(fetchDrivers, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchDrivers()
    } finally {
      setRefreshing(false)
    }
  }

  const fetchDrivers = async () => {
    try {
      const usersData = await getUsers()
      const driverUsers = usersData.filter((u: any) => u.role === "driver")
      setDrivers(driverUsers)
    } catch (error) {
      console.error("Error fetching drivers:", error)
      toast({
        title: "Error",
        description: "Failed to load drivers",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteDriver = async (driverId: string, driverName: string) => {
    if (!confirm(`Are you sure you want to delete ${driverName}? This cannot be undone.`)) return

    try {
      const { deleteUser } = await import("@/app/actions/data-actions")
      await deleteUser(driverId)

      toast({
        title: "Driver Removed",
        description: `${driverName} has been removed from the system`,
      })
      fetchDrivers()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete driver",
        variant: "destructive",
      })
    }
  }

  const [togglingDriverId, setTogglingDriverId] = useState<string | null>(null)

  /**
   * Deactivating keeps the account and its delivery history (unlike Delete,
   * which erases both). deactivateDriver() refuses when the driver still
   * has an active route, so that message is shown as-is rather than a
   * generic failure - it names exactly what to reassign or cancel first.
   */
  const handleToggleDriverActive = async (driver: any, driverName: string) => {
    const isActive = getDriverDetails(driver)?.active !== false
    if (isActive && !confirm(`Deactivate ${driverName}? They won't be able to sign in or be assigned new routes until reactivated.`)) {
      return
    }

    setTogglingDriverId(driver.id)
    try {
      const { deactivateDriver, reactivateDriver } = await import("@/app/actions/data-actions")
      if (isActive) {
        await deactivateDriver(driver.id)
        toast({ title: "Driver deactivated", description: `${driverName} can no longer sign in or be assigned routes.` })
      } else {
        await reactivateDriver(driver.id)
        toast({ title: "Driver reactivated", description: `${driverName} can sign in and be assigned routes again.` })
      }
      fetchDrivers()
    } catch (error: any) {
      toast({
        title: isActive ? "Could not deactivate driver" : "Could not reactivate driver",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setTogglingDriverId(null)
    }
  }

  const filteredDrivers =
    selectedRegion === "all" ? drivers : drivers.filter((d) => getDriverDetails(d)?.region === selectedRegion)

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <AdminHeader title="Driver Management">
            <RefreshButton onRefresh={handleRefresh} refreshing={refreshing} />
          </AdminHeader>

          <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-foreground">Registered Drivers</h2>
              <div className="flex items-center gap-3">
                <RegionFilter value={selectedRegion} onChange={setSelectedRegion} />
                <Button onClick={() => setIsAddModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Driver
                </Button>
              </div>
            </div>

            {loading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Loading drivers...</p>
              </Card>
            ) : filteredDrivers.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No drivers found. Add your first driver to get started.</p>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Driver
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Region
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Vehicle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        License
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {filteredDrivers.map((driver) => {
                      const driverDetails = getDriverDetails(driver)
                      const driverName = `${driver.first_name || ""} ${driver.last_name || ""}`.trim()
                      return (
                        <tr key={driver.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${driver.id}`} />
                                <AvatarFallback>
                                  {driver.first_name?.[0]}
                                  {driver.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                  {driverName}
                                  {driverDetails?.active === false && (
                                    <Badge variant="outline" className="border-destructive text-destructive">
                                      Deactivated
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">Driver</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <RegionBadge region={driverDetails?.region} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-foreground">{driver.phone || "N/A"}</div>
                            <div className="text-sm text-muted-foreground">{driver.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-foreground">{driverDetails?.vehicle_type || "N/A"}</div>
                            <div className="text-sm text-muted-foreground">{driverDetails?.vehicle_plate || "N/A"}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-foreground">{driverDetails?.license_number || "N/A"}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="mr-2"
                                  onClick={() => setEditingDriver(driver)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit driver details</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="mr-2"
                                  onClick={() => setViewingLocationDriver(driver)}
                                >
                                  <MapIcon className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View on map</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="mr-2"
                                  disabled={togglingDriverId === driver.id}
                                  onClick={() => handleToggleDriverActive(driver, driverName)}
                                >
                                  {driverDetails?.active === false ? (
                                    <UserCheck className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <UserX className="h-4 w-4 text-amber-600" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{driverDetails?.active === false ? "Reactivate driver" : "Deactivate driver"}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteDriver(driver.id, driverName)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete driver</TooltipContent>
                            </Tooltip>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              </Card>
            )}
          </PullToRefresh>
        </div>

        <AddUserModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={fetchDrivers} />

        <EditUserModal
          isOpen={!!editingDriver}
          onClose={() => setEditingDriver(null)}
          user={editingDriver}
          onSuccess={fetchDrivers}
        />

        {viewingLocationDriver && (
          <DriverLocationModal
            open={!!viewingLocationDriver}
            onOpenChange={(open) => !open && setViewingLocationDriver(null)}
            driverName={`${viewingLocationDriver.first_name || ""} ${viewingLocationDriver.last_name || ""}`.trim()}
            latitude={getDriverDetails(viewingLocationDriver)?.current_latitude ?? null}
            longitude={getDriverDetails(viewingLocationDriver)?.current_longitude ?? null}
            lastUpdate={getDriverDetails(viewingLocationDriver)?.last_location_update ?? null}
          />
        )}
      </div>
    </TooltipProvider>
  )
}

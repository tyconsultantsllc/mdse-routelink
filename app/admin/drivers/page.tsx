"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, MapIcon, Trash2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { AddUserModal } from "@/components/add-user-modal"
import { EditUserModal } from "@/components/edit-user-modal"
import { DriverLocationModal } from "@/components/driver-location-modal"
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getUsers } from "@/app/actions/data-actions"

export default function DriverManagement() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<any>(null)
  const [viewingLocationDriver, setViewingLocationDriver] = useState<any>(null)
  const { toast } = useToast()
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDrivers()

    const interval = setInterval(fetchDrivers, 15000)
    return () => clearInterval(interval)
  }, [])

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

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar />

        <div className="flex flex-col flex-1 overflow-hidden">
          <AdminHeader title="Driver Management" />

          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-foreground">Registered Drivers</h2>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Driver
              </Button>
            </div>

            {loading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Loading drivers...</p>
              </Card>
            ) : drivers.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No drivers found. Add your first driver to get started.</p>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Driver
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
                    {drivers.map((driver) => {
                      const driverDetails = driver.drivers?.[0]
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
                                <div className="text-sm font-medium text-foreground">{driverName}</div>
                                <div className="text-sm text-muted-foreground">Driver</div>
                              </div>
                            </div>
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
              </Card>
            )}
          </div>
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
            latitude={viewingLocationDriver.drivers?.[0]?.current_latitude ?? null}
            longitude={viewingLocationDriver.drivers?.[0]?.current_longitude ?? null}
            lastUpdate={viewingLocationDriver.drivers?.[0]?.last_location_update ?? null}
          />
        )}
      </div>
    </TooltipProvider>
  )
}

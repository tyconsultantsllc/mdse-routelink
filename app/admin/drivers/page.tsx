"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, MapIcon, Trash2 } from 'lucide-react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { AddDriverModal } from "@/components/add-driver-modal"
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getUsers } from "@/app/actions/data-actions"

export default function DriverManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { toast } = useToast()
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDrivers()
  }, [])

  const fetchDrivers = async () => {
    try {
      const usersData = await getUsers()
      
      // Filter for driver users
      const driverUsers = usersData.filter((u: any) => u.role === "driver")
      
      const driversWithDetails = driverUsers.map((user: any) => ({
        id: user.id,
        user: {
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email
        },
        phone: user.phone,
        vehicle_type: user.vehicle_type,
        vehicle_plate: user.vehicle_plate,
        license_number: user.license_number,
        status: user.status || "inactive",
      }))

      setDrivers(driversWithDetails)
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

  const handleEditDriver = (driverId: string, driverName: string) => {
    toast({
      title: "Edit Driver",
      description: `Opening editor for ${driverName}`,
    })
  }

  const handleDeleteDriver = async (driverId: string, driverName: string) => {
    toast({
      title: "Driver Removed",
      description: `${driverName} has been removed from the system`,
    })
    fetchDrivers()
  }

  const handleViewOnMap = (driverId: string, driverName: string) => {
    toast({
      title: "View on Map",
      description: `Showing current location of ${driverName}`,
    })
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
              <Button onClick={() => setIsModalOpen(true)}>
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
                    {drivers.map((driver) => (
                      <tr key={driver.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Avatar className="h-10 w-10">
                              <AvatarImage
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${driver.id}`}
                              />
                              <AvatarFallback>
                                {driver.user?.first_name?.[0]}
                                {driver.user?.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-foreground">
                                {driver.user?.first_name} {driver.user?.last_name}
                              </div>
                              <div className="text-sm text-muted-foreground">Driver</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-foreground">{driver.phone || "N/A"}</div>
                          <div className="text-sm text-muted-foreground">{driver.user?.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-foreground">{driver.vehicle_type || "N/A"}</div>
                          <div className="text-sm text-muted-foreground">{driver.vehicle_plate || "N/A"}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-foreground">{driver.license_number || "N/A"}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="mr-2"
                                onClick={() =>
                                  handleEditDriver(
                                    driver.id,
                                    `${driver.user?.first_name} ${driver.user?.last_name}`
                                  )
                                }
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
                                onClick={() =>
                                  handleViewOnMap(
                                    driver.id,
                                    `${driver.user?.first_name} ${driver.user?.last_name}`
                                  )
                                }
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
                                onClick={() =>
                                  handleDeleteDriver(
                                    driver.id,
                                    `${driver.user?.first_name} ${driver.user?.last_name}`
                                  )
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete driver</TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </div>

        <AddDriverModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      </div>
    </TooltipProvider>
  )
}

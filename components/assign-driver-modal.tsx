"use client"

import { useState, useEffect } from "react"
import { UserPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface AssignDriverModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routeName: string
  routeId: number // Added routeId to actually save the assignment
  currentDriver?: string
  onAssign: (driverId: string, driverName: string) => void
}

interface Driver {
  id: string
  name: string
  avatar: string
  activeRoutes: number
  status: "available" | "busy" | "off-duty"
}

export function AssignDriverModal({ open, onOpenChange, routeName, routeId, currentDriver, onAssign }: AssignDriverModalProps) {
  const { toast } = useToast()
  const [selectedDriver, setSelectedDriver] = useState<string>("")
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open) {
      fetchDrivers()
    }
  }, [open])

  const fetchDrivers = async () => {
    try {
      setLoading(true)
      const { getUsers } = await import("@/app/actions/data-actions")
      const users = await getUsers()
      
      const driverUsers = users.filter((u: any) => u.role === "driver").map((u: any) => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`,
        activeRoutes: 0, // TODO: Calculate from routes table
        status: "available" as const, // TODO: Get from drivers table
      }))
      
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

  const handleAssign = async () => {
    if (!selectedDriver) {
      toast({
        title: "Validation Error",
        description: "Please select a driver",
        variant: "destructive",
      })
      return
    }

    try {
      const { assignDriverToRoute } = await import("@/app/actions/data-actions")
      await assignDriverToRoute(routeId, selectedDriver)

      const driver = drivers.find((d) => d.id === selectedDriver)
      if (driver) {
        onAssign(selectedDriver, driver.name)
        toast({
          title: currentDriver ? "Driver Reassigned" : "Driver Assigned",
          description: `${driver.name} has been assigned to ${routeName}`,
        })
        onOpenChange(false)
        setSelectedDriver("")
      }
    } catch (error) {
      console.error("Error assigning driver:", error)
      toast({
        title: "Error",
        description: "Failed to assign driver",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800 hover:bg-green-100"
      case "busy":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
      case "off-duty":
        return "bg-gray-100 text-gray-800 hover:bg-gray-100"
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">
            {currentDriver ? "Reassign Driver" : "Assign Driver to Route"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center">Route: {routeName}</p>
          {currentDriver && (
            <p className="text-sm text-muted-foreground text-center">Current driver: {currentDriver}</p>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="driver">Select Driver</Label>
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading drivers...
              </div>
            ) : drivers.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No drivers available. Add drivers first.
              </div>
            ) : (
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      <div className="flex items-center gap-3 py-1">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={driver.avatar || "/placeholder.svg"} />
                          <AvatarFallback>{driver.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{driver.name}</p>
                          <p className="text-xs text-muted-foreground">{driver.activeRoutes} active routes</p>
                        </div>
                        <Badge className={getStatusColor(driver.status)}>
                          {driver.status === "off-duty"
                            ? "Off Duty"
                            : driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedDriver && (
            <div className="p-4 bg-muted rounded-md">
              {(() => {
                const driver = drivers.find((d) => d.id === selectedDriver)
                return driver ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={driver.avatar || "/placeholder.svg"} />
                      <AvatarFallback>{driver.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{driver.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Currently has {driver.activeRoutes} active route{driver.activeRoutes !== 1 ? "s" : ""}
                      </p>
                      <Badge className={`${getStatusColor(driver.status)} mt-1`}>
                        {driver.status === "off-duty"
                          ? "Off Duty"
                          : driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ) : null
              })()}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => {
                onOpenChange(false)
                setSelectedDriver("")
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAssign} className="flex-1">
              {currentDriver ? "Reassign Driver" : "Assign Driver"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

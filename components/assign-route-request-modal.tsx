"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getDriverDetails } from "@/lib/region-utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface AssignRouteRequestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: any
  onAssigned: () => void
}

export function AssignRouteRequestModal({ open, onOpenChange, request, onAssigned }: AssignRouteRequestModalProps) {
  const { toast } = useToast()
  const [drivers, setDrivers] = useState<any[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(true)
  const [driverId, setDriverId] = useState("")
  const [routeName, setRouteName] = useState("")
  const [priority, setPriority] = useState("medium")
  const [startTime, setStartTime] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [conflictWarning, setConflictWarning] = useState<Array<{ id: number; name: string }> | null>(null)

  useEffect(() => {
    if (!open || !request) return

    setRouteName(`${request.pharmacies?.name || "Pharmacy"} - ${new Date().toLocaleDateString()}`)
    setPriority(request.is_emergency ? "urgent" : "medium")
    setDriverId("")
    setStartTime("")

    const loadDrivers = async () => {
      setLoadingDrivers(true)
      try {
        const { getUsers } = await import("@/app/actions/data-actions")
        const users = await getUsers()
        const pharmacyRegion = request.pharmacies?.region
        const allDrivers = users.filter((u: any) => u.role === "driver")
        // Prefer drivers in the same region as the requesting pharmacy, but
        // don't hide everyone if the pharmacy or its drivers have no region
        // set yet - that would make the feature unusable during rollout.
        const regionMatched = pharmacyRegion
          ? allDrivers.filter((d: any) => getDriverDetails(d)?.region === pharmacyRegion)
          : allDrivers
        setDrivers(regionMatched.length > 0 ? regionMatched : allDrivers)
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" })
      } finally {
        setLoadingDrivers(false)
      }
    }
    loadDrivers()
  }, [open, request])

  const handleAssign = async () => {
    if (!driverId) {
      toast({ title: "Select a driver", variant: "destructive" })
      return
    }

    try {
      if (startTime) {
        const today = new Date()
        const [h, m] = startTime.split(':')
        today.setHours(parseInt(h), parseInt(m), 0, 0)
        const estimatedDuration = (request.stops?.length || 0) * 30
        const endTimestamp = new Date(today.getTime() + estimatedDuration * 60000).toISOString()

        const { checkDriverConflicts } = await import("@/app/actions/data-actions")
        const conflicts = await checkDriverConflicts(driverId, [
          { start: today.toISOString(), end: endTimestamp, label: routeName },
        ])
        if (conflicts.length > 0) {
          setConflictWarning(conflicts[0].conflictsWith)
          return
        }
      }

      await performAssign()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const performAssign = async () => {
    setSubmitting(true)
    try {
      const { assignRouteRequestToDriver } = await import("@/app/actions/data-actions")
      await assignRouteRequestToDriver({
        requestId: request.id,
        driverId,
        routeName,
        priority,
        startTime: startTime || undefined,
      })
      toast({ title: "Route created", description: "The request has been assigned and is now a live route." })
      setConflictWarning(null)
      onAssigned()
      onOpenChange(false)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (!request) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Driver</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="routeName">Route Name</Label>
            <Input id="routeName" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="driver">Driver</Label>
            <Select value={driverId} onValueChange={setDriverId} disabled={loadingDrivers}>
              <SelectTrigger id="driver">
                <SelectValue placeholder={loadingDrivers ? "Loading..." : "Select a driver"} />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.first_name} {d.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="startTime">Start Time</Label>
            <Input
              id="startTime"
              type="time"
              step={900}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleAssign} disabled={submitting || !driverId} className="w-full">
            {submitting ? "Creating Route..." : "Create Route & Assign"}
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={!!conflictWarning} onOpenChange={(o) => !o && setConflictWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scheduling Conflict</AlertDialogTitle>
            <AlertDialogDescription>
              This driver is already assigned to a route that overlaps this time: {conflictWarning?.map((c) => c.name).join(", ")}. Assign anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConflictWarning(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performAssign}>Assign Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

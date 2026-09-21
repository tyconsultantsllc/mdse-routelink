"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CalendarRoute {
  id: number
  name: string
  status: "pending" | "in-progress" | "completed"
  priority: "low" | "medium" | "high" | "urgent"
  startTime: string
  endTime: string
  driverConfirmation: "pending" | "confirmed" | "declined"
  stopCount: number
}

interface DriverCalendarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routesByDate: Map<string, CalendarRoute[]>
  onConfirmationChanged: () => void
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function DriverCalendarDialog({ open, onOpenChange, routesByDate, onConfirmationChanged }: DriverCalendarDialogProps) {
  const { toast } = useToast()
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDateKey, setSelectedDateKey] = useState<string>(formatDateKey(new Date()))
  const [decliningRouteId, setDecliningRouteId] = useState<number | null>(null)
  const [declineReason, setDeclineReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const gridDays = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i))
    return days
  }, [viewDate])

  const selectedRoutes = routesByDate.get(selectedDateKey) || []

  const priorityColor = (p: string) =>
    p === "urgent"
      ? "bg-red-100 text-red-800"
      : p === "high"
        ? "bg-orange-100 text-orange-800"
        : p === "medium"
          ? "bg-blue-100 text-blue-800"
          : "bg-gray-100 text-gray-800"

  const handleConfirm = async (routeId: number) => {
    setSubmitting(true)
    try {
      const { confirmRouteAssignment } = await import("@/lib/driver-actions")
      await confirmRouteAssignment(routeId)
      toast({ title: "Confirmed", description: "This route has been confirmed." })
      onConfirmationChanged()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecline = async () => {
    if (decliningRouteId == null) return
    setSubmitting(true)
    try {
      const { declineRouteAssignment } = await import("@/lib/driver-actions")
      await declineRouteAssignment(decliningRouteId, declineReason)
      toast({ title: "Declined", description: "Dispatch has been notified to reassign this route." })
      setDecliningRouteId(null)
      setDeclineReason("")
      onConfirmationChanged()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>My Schedule</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="font-medium">{viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
          <Button variant="ghost" size="icon" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {dayLabels.map((label) => (
            <div key={label} className="text-xs text-muted-foreground font-medium py-1">
              {label}
            </div>
          ))}
          {gridDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />
            const dateKey = formatDateKey(day)
            const dayRoutes = routesByDate.get(dateKey) || []
            const isSelected = dateKey === selectedDateKey
            const isToday = dateKey === formatDateKey(new Date())
            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDateKey(dateKey)}
                className={`h-11 rounded-md text-sm relative flex flex-col items-center justify-center transition-colors ${
                  isSelected ? "bg-primary text-primary-foreground" : isToday ? "bg-muted font-semibold" : "hover:bg-muted"
                }`}
              >
                {day.getDate()}
                {dayRoutes.length > 0 && (
                  <span className="absolute bottom-1 flex gap-0.5">
                    {dayRoutes.slice(0, 4).map((r) => (
                      <span
                        key={r.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelected
                            ? "bg-primary-foreground"
                            : r.driverConfirmation === "confirmed"
                              ? "bg-green-500"
                              : r.driverConfirmation === "declined"
                                ? "bg-red-500"
                                : "bg-amber-500"
                        }`}
                      />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Confirmed
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Pending
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Declined
          </span>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <p className="text-sm font-medium">
            {new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
          {selectedRoutes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No routes scheduled this day.</p>
          ) : (
            selectedRoutes.map((route) => (
              <div
                key={route.id}
                className={`border rounded-lg p-3 space-y-2 border-l-4 ${
                  route.driverConfirmation === "confirmed"
                    ? "border-l-green-500 bg-green-50/50"
                    : route.driverConfirmation === "declined"
                      ? "border-l-red-500 bg-red-50/50"
                      : "border-l-amber-500 bg-amber-50/50"
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-medium text-sm">{route.name}</span>
                  <Badge className={priorityColor(route.priority)}>{route.priority}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {route.startTime} - {route.endTime} - {route.stopCount} stop{route.stopCount !== 1 ? "s" : ""}
                </p>

                {route.driverConfirmation === "confirmed" && (
                  <Badge className="bg-green-100 text-green-800">
                    <Check className="h-3 w-3 mr-1" />
                    Confirmed
                  </Badge>
                )}
                {route.driverConfirmation === "declined" && (
                  <Badge className="bg-red-100 text-red-800">
                    <X className="h-3 w-3 mr-1" />
                    Declined
                  </Badge>
                )}

                {route.driverConfirmation === "pending" && decliningRouteId !== route.id && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleConfirm(route.id)} disabled={submitting} className="flex-1">
                      <Check className="h-4 w-4 mr-1" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDecliningRouteId(route.id)}
                      disabled={submitting}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                )}

                {decliningRouteId === route.id && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Why can't you take this route? (optional)"
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={handleDecline} disabled={submitting} className="flex-1">
                        Confirm Decline
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDecliningRouteId(null)
                          setDeclineReason("")
                        }}
                        disabled={submitting}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

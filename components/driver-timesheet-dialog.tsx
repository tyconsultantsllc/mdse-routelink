"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronLeft, ChevronRight, Pencil, Clock3 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface TimesheetDay {
  date: string
  clockIn: string | null
  clockOut: string | null
  breakMinutes: number
  notes: string | null
  source: "auto" | "manual" | "none"
  routeNames: string[]
  pendingRequest: {
    id: string
    clockIn: string | null
    clockOut: string | null
    breakMinutes: number
    reason: string
    createdAt: string
  } | null
}

interface DriverTimesheetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Monday of the week containing `d`, as a YYYY-MM-DD string (local time -
// this is just for picking which week to show, display-only).
function getWeekStart(d: Date) {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // shift Sunday back to the prior Monday
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`
}

function addDaysToDateString(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatDateLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

// HH:MM in the viewer's local time, for pre-filling a <input type="time">
function toTimeInput(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

// Combines a work_date (YYYY-MM-DD) with a local HH:MM into a UTC ISO
// timestamp, or null if the time field was left blank.
function toISO(workDate: string, time: string) {
  if (!time) return null
  return new Date(`${workDate}T${time}:00`).toISOString()
}

function calcHours(clockIn: string | null, clockOut: string | null, breakMinutes: number) {
  if (!clockIn || !clockOut) return null
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  if (ms <= 0) return null
  const hours = ms / 3600000 - breakMinutes / 60
  return Math.max(0, Math.round(hours * 100) / 100)
}

export function DriverTimesheetDialog({ open, onOpenChange }: DriverTimesheetDialogProps) {
  const { toast } = useToast()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [days, setDays] = useState<TimesheetDay[]>([])
  const [loading, setLoading] = useState(true)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [clockInTime, setClockInTime] = useState("")
  const [clockOutTime, setClockOutTime] = useState("")
  const [breakMinutes, setBreakMinutes] = useState("0")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    fetchWeek()
  }, [open, weekStart])

  const fetchWeek = async () => {
    setLoading(true)
    try {
      const { getMyTimesheet } = await import("@/app/actions/data-actions")
      const data = await getMyTimesheet(weekStart)
      setDays(data)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (day: TimesheetDay) => {
    setEditingDate(day.date)
    setClockInTime(toTimeInput(day.clockIn))
    setClockOutTime(toTimeInput(day.clockOut))
    setBreakMinutes(String(day.breakMinutes || 0))
    setReason("")
  }

  const cancelEdit = () => {
    setEditingDate(null)
    setReason("")
  }

  const submitEdit = async () => {
    if (!editingDate) return
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Let your admin know why you're requesting this change.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const { requestTimesheetEdit } = await import("@/app/actions/data-actions")
      await requestTimesheetEdit({
        workDate: editingDate,
        clockIn: toISO(editingDate, clockInTime),
        clockOut: toISO(editingDate, clockOutTime),
        breakMinutes: Number(breakMinutes) || 0,
        reason,
      })
      toast({ title: "Request sent", description: "Your admin will review this change." })
      cancelEdit()
      fetchWeek()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const weekEnd = addDaysToDateString(weekStart, 6)
  const weeklyTotal = days.reduce((sum, d) => sum + (calcHours(d.clockIn, d.clockOut, d.breakMinutes) || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>My Timesheet</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setWeekStart((w) => addDaysToDateString(w, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-medium text-center">
            {formatDateLabel(weekStart)} - {formatDateLabel(weekEnd)}
          </p>
          <Button variant="ghost" size="icon" onClick={() => setWeekStart((w) => addDaysToDateString(w, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        ) : (
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-2 pr-2">
              {days.map((day) => {
                const hours = calcHours(day.clockIn, day.clockOut, day.breakMinutes)
                const isEditing = editingDate === day.date
                return (
                  <div key={day.date} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{formatDateLabel(day.date)}</span>
                      {day.pendingRequest ? (
                        <Badge className="bg-amber-100 text-amber-800">Pending approval</Badge>
                      ) : day.source === "manual" ? (
                        <Badge className="bg-green-100 text-green-800">Approved</Badge>
                      ) : day.source === "auto" ? (
                        <Badge variant="secondary">From routes</Badge>
                      ) : (
                        <Badge variant="outline">No hours logged</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5 shrink-0" />
                      {day.clockIn && day.clockOut ? (
                        <span>
                          {new Date(day.clockIn).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} -{" "}
                          {new Date(day.clockOut).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          {day.breakMinutes > 0 ? ` (${day.breakMinutes}m break)` : ""}
                          {hours != null ? ` - ${hours}h` : ""}
                        </span>
                      ) : (
                        <span>No clock in/out recorded</span>
                      )}
                    </div>

                    {day.routeNames.length > 0 && (
                      <p className="text-xs text-muted-foreground">Based on: {day.routeNames.join(", ")}</p>
                    )}

                    {day.pendingRequest && (
                      <div className="text-xs bg-amber-50 border border-amber-200 rounded-md p-2 text-amber-900">
                        <p className="font-medium">Requested change awaiting review</p>
                        <p>
                          {day.pendingRequest.clockIn
                            ? new Date(day.pendingRequest.clockIn).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                            : "--"}{" "}
                          -{" "}
                          {day.pendingRequest.clockOut
                            ? new Date(day.pendingRequest.clockOut).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                            : "--"}
                        </p>
                        <p className="italic mt-1">"{day.pendingRequest.reason}"</p>
                      </div>
                    )}

                    {!day.pendingRequest && !isEditing && (
                      <Button size="sm" variant="outline" onClick={() => startEdit(day)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Request edit
                      </Button>
                    )}

                    {isEditing && (
                      <div className="space-y-2 pt-1 border-t">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Clock in</Label>
                            <Input type="time" value={clockInTime} onChange={(e) => setClockInTime(e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Clock out</Label>
                            <Input type="time" value={clockOutTime} onChange={(e) => setClockOutTime(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Break (minutes)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={breakMinutes}
                            onChange={(e) => setBreakMinutes(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Why are you requesting this change?</Label>
                          <Textarea
                            placeholder="e.g. Forgot to clock out, actually left at 5:30"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={submitEdit} disabled={submitting} className="flex-1">
                            Submit for approval
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} disabled={submitting} className="flex-1">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}

        {!loading && (
          <div className="flex items-center justify-between pt-2 border-t text-sm">
            <span className="text-muted-foreground">Week total</span>
            <span className="font-medium">{Math.round(weeklyTotal * 100) / 100}h</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

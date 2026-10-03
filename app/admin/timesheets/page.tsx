"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Check, X, Pencil, Clock3, Download } from "lucide-react"
import { exportToCSV } from "@/lib/export-utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { RefreshButton } from "@/components/refresh-button"
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

function getWeekStart(d: Date) {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
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

function toTimeInput(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

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

function formatTime(iso: string | null) {
  if (!iso) return "--"
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export default function AdminTimesheetsPage() {
  const { toast } = useToast()
  const [pending, setPending] = useState<any[]>([])
  const [loadingPending, setLoadingPending] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [reviewing, setReviewing] = useState<string | null>(null)

  const [drivers, setDrivers] = useState<any[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState<string>("")
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [days, setDays] = useState<TimesheetDay[]>([])
  const [loadingDays, setLoadingDays] = useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [clockInTime, setClockInTime] = useState("")
  const [clockOutTime, setClockOutTime] = useState("")
  const [breakMinutes, setBreakMinutes] = useState("0")
  const [savingEntry, setSavingEntry] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchPending()
    fetchDrivers()
    const interval = setInterval(fetchPending, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedDriverId) fetchDriverWeek()
  }, [selectedDriverId, weekStart])

  const fetchPending = async () => {
    try {
      const { getPendingTimesheetEdits } = await import("@/app/actions/data-actions")
      const data = await getPendingTimesheetEdits()
      setPending(data)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoadingPending(false)
    }
  }

  const fetchDrivers = async () => {
    try {
      const { getUsers } = await import("@/app/actions/data-actions")
      const users = await getUsers()
      setDrivers((users || []).filter((u: any) => u.role === "driver"))
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const fetchDriverWeek = async () => {
    setLoadingDays(true)
    try {
      const { getDriverTimesheet } = await import("@/app/actions/data-actions")
      const data = await getDriverTimesheet(selectedDriverId, weekStart)
      setDays(data)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoadingDays(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([fetchPending(), selectedDriverId ? fetchDriverWeek() : Promise.resolve()])
    } finally {
      setRefreshing(false)
    }
  }

  const driverName = (request: any) => {
    const driverInfo: any = Array.isArray(request.drivers) ? request.drivers[0] : request.drivers
    const userInfo: any = Array.isArray(driverInfo?.users) ? driverInfo.users[0] : driverInfo?.users
    return userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : "Unknown driver"
  }

  const handleApprove = async (requestId: string) => {
    setReviewing(requestId)
    try {
      const { reviewTimesheetEdit } = await import("@/app/actions/data-actions")
      await reviewTimesheetEdit(requestId, "approved")
      toast({ title: "Approved", description: "The driver's timesheet has been updated." })
      fetchPending()
      if (selectedDriverId) fetchDriverWeek()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setReviewing(null)
    }
  }

  const handleReject = async (requestId: string) => {
    setReviewing(requestId)
    try {
      const { reviewTimesheetEdit } = await import("@/app/actions/data-actions")
      await reviewTimesheetEdit(requestId, "rejected", reviewNote)
      toast({ title: "Rejected", description: "The driver has been notified." })
      setRejectingId(null)
      setReviewNote("")
      fetchPending()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setReviewing(null)
    }
  }

  const startEditEntry = (day: TimesheetDay) => {
    setEditingDate(day.date)
    setClockInTime(toTimeInput(day.clockIn))
    setClockOutTime(toTimeInput(day.clockOut))
    setBreakMinutes(String(day.breakMinutes || 0))
  }

  const saveEntry = async () => {
    if (!editingDate || !selectedDriverId) return
    setSavingEntry(true)
    try {
      const { adminSetTimesheetEntry } = await import("@/app/actions/data-actions")
      await adminSetTimesheetEntry({
        driverId: selectedDriverId,
        workDate: editingDate,
        clockIn: toISO(editingDate, clockInTime),
        clockOut: toISO(editingDate, clockOutTime),
        breakMinutes: Number(breakMinutes) || 0,
      })
      toast({ title: "Saved" })
      setEditingDate(null)
      fetchDriverWeek()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSavingEntry(false)
    }
  }

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const { getWeeklyTimesheetReport } = await import("@/app/actions/data-actions")
      const rows = await getWeeklyTimesheetReport(weekStart)
      if (rows.length === 0) {
        toast({ title: "Nothing to export", description: "No hours recorded for this week." })
        return
      }
      const csvRows = rows.map((r: any) => ({
        Driver: r.driverName,
        Date: r.date,
        "Clock In": r.clockIn ? formatTime(r.clockIn) : "",
        "Clock Out": r.clockOut ? formatTime(r.clockOut) : "",
        "Break (min)": r.breakMinutes,
        Hours: r.hours ?? "",
        Status: r.source === "manual" ? "Approved" : r.source === "auto" ? "From routes" : "",
      }))
      await exportToCSV(csvRows, `timesheets_${weekStart}_to_${weekEnd}`)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const weekEnd = addDaysToDateString(weekStart, 6)
  const weeklyTotal = useMemo(
    () => days.reduce((sum, d) => sum + (calcHours(d.clockIn, d.clockOut, d.breakMinutes) || 0), 0),
    [days],
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AdminHeader title="Timesheets">
          <RefreshButton onRefresh={handleRefresh} refreshing={refreshing} />
        </AdminHeader>
        <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto p-6 space-y-8">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Pending Approvals {pending.length > 0 && <span className="text-destructive">({pending.length})</span>}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Timesheet changes drivers have requested, waiting for your review.
            </p>

            <div className="mt-4 space-y-3">
              {loadingPending ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">Loading...</p>
                </Card>
              ) : pending.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No pending timesheet requests.</p>
                </Card>
              ) : (
                pending.map((request) => (
                  <Card key={request.id} className="p-4 border-l-4 border-l-amber-500">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium">{driverName(request)}</span>
                          <Badge variant="secondary">{formatDateLabel(request.work_date)}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Requested {new Date(request.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-foreground flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatTime(request.requested_clock_in)} - {formatTime(request.requested_clock_out)}
                          {request.requested_break_minutes > 0 ? ` (${request.requested_break_minutes}m break)` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground italic mt-1">"{request.reason}"</p>

                        {rejectingId === request.id && (
                          <div className="mt-3 space-y-2">
                            <Textarea
                              placeholder="Why is this being rejected? (optional, the driver will see this)"
                              value={reviewNote}
                              onChange={(e) => setReviewNote(e.target.value)}
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(request.id)}
                                disabled={reviewing === request.id}
                              >
                                Confirm Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRejectingId(null)
                                  setReviewNote("")
                                }}
                                disabled={reviewing === request.id}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      {rejectingId !== request.id && (
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button size="sm" onClick={() => handleApprove(request.id)} disabled={reviewing === request.id}>
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRejectingId(request.id)}
                            disabled={reviewing === request.id}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-foreground">Browse a Driver's Timesheet</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  View any driver's hours by week, and correct an entry directly without needing a request.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleExportCSV} disabled={exporting}>
                <Download className="h-4 w-4 mr-1" />
                {exporting ? "Exporting..." : "Export week as CSV"}
              </Button>
            </div>

            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setWeekStart((w) => addDaysToDateString(w, -7))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-sm font-medium">
                  {formatDateLabel(weekStart)} - {formatDateLabel(weekEnd)}
                </p>
                <Button variant="ghost" size="icon" onClick={() => setWeekStart((w) => addDaysToDateString(w, 7))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select a driver to browse" />
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

            <p className="text-xs text-muted-foreground mt-2">
              The CSV export covers every driver for the week shown above, not just the one selected below.
            </p>

            {selectedDriverId && (
              <Card className="mt-4 p-4">
                {loadingDays ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
                ) : (
                  <div className="space-y-2">
                    {days.map((day) => {
                      const hours = calcHours(day.clockIn, day.clockOut, day.breakMinutes)
                      const isEditing = editingDate === day.date
                      return (
                        <div key={day.date} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <span className="text-sm font-medium">{formatDateLabel(day.date)}</span>
                            <div className="flex items-center gap-2">
                              {day.source === "manual" && <Badge className="bg-green-100 text-green-800">Manually set</Badge>}
                              {day.source === "auto" && <Badge variant="secondary">From routes</Badge>}
                              {day.source === "none" && <Badge variant="outline">No hours</Badge>}
                              {!isEditing && (
                                <Button size="sm" variant="ghost" onClick={() => startEditEntry(day)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {!isEditing ? (
                            <p className="text-sm text-muted-foreground">
                              {formatTime(day.clockIn)} - {formatTime(day.clockOut)}
                              {day.breakMinutes > 0 ? ` (${day.breakMinutes}m break)` : ""}
                              {hours != null ? ` - ${hours}h` : ""}
                              {day.routeNames.length > 0 && ` - ${day.routeNames.join(", ")}`}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-xs">Clock in</Label>
                                  <Input type="time" value={clockInTime} onChange={(e) => setClockInTime(e.target.value)} />
                                </div>
                                <div>
                                  <Label className="text-xs">Clock out</Label>
                                  <Input type="time" value={clockOutTime} onChange={(e) => setClockOutTime(e.target.value)} />
                                </div>
                                <div>
                                  <Label className="text-xs">Break (min)</Label>
                                  <Input type="number" min={0} value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={saveEntry} disabled={savingEntry}>
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingDate(null)} disabled={savingEntry}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-between pt-2 border-t text-sm">
                      <span className="text-muted-foreground">Week total</span>
                      <span className="font-medium">{Math.round(weeklyTotal * 100) / 100}h</span>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        </PullToRefresh>
      </div>
    </div>
  )
}

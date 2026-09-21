"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface WeeklyDriverScheduleProps {
  scheduledRoutes: Record<string, any[]>
  onSelectRoute: (route: any) => void
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function WeeklyDriverSchedule({ scheduledRoutes, onSelectRoute }: WeeklyDriverScheduleProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(true)

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const { getUsers } = await import("@/app/actions/data-actions")
        const users = await getUsers()
        setDrivers(
          users
            .filter((u: any) => u.role === "driver")
            .map((u: any) => ({ id: u.id, name: `${u.first_name || ""} ${u.last_name || ""}`.trim() }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name)),
        )
      } catch (error) {
        console.error("Error loading drivers:", error)
      } finally {
        setLoadingDrivers(false)
      }
    }
    loadDrivers()
  }, [])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  const confirmationDotColor = (confirmation: string) =>
    confirmation === "confirmed" ? "bg-green-500" : confirmation === "declined" ? "bg-red-500" : "bg-amber-500"

  const confirmationBg = (confirmation: string) =>
    confirmation === "confirmed"
      ? "bg-green-50 border-green-200"
      : confirmation === "declined"
        ? "bg-red-50 border-red-200"
        : "bg-amber-50 border-amber-200"

  const weekLabel = `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">{weekLabel}</h3>
        <Button variant="outline" size="icon" onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Confirmed</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Pending</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Declined</span>
      </div>

      {loadingDrivers ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading drivers...</p>
      ) : drivers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No drivers found.</p>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: "900px" }}>
            <div className="grid grid-cols-[140px_repeat(7,1fr)] gap-1 mb-1">
              <div />
              {weekDays.map((day) => {
                const isToday = formatDateKey(day) === formatDateKey(new Date())
                return (
                  <div key={day.toISOString()} className={`text-center text-xs font-medium py-1 rounded ${isToday ? "bg-muted" : ""}`}>
                    {dayLabels[day.getDay()]} {day.getDate()}
                  </div>
                )
              })}
            </div>

            {drivers.map((driver) => (
              <div key={driver.id} className="grid grid-cols-[140px_repeat(7,1fr)] gap-1 mb-1">
                <div className="text-sm font-medium py-2 pr-2 truncate flex items-center">{driver.name}</div>
                {weekDays.map((day) => {
                  const dateKey = formatDateKey(day)
                  const dayRoutes = (scheduledRoutes[dateKey] || []).filter((r) => r.driverId === driver.id)
                  return (
                    <div key={dateKey} className="min-h-[60px] space-y-1">
                      {dayRoutes.map((route) => (
                        <button
                          key={route.id}
                          onClick={() => onSelectRoute(route)}
                          className={`w-full text-left text-xs p-1.5 rounded border ${confirmationBg(route.driverConfirmation)} hover:opacity-80 transition-opacity relative`}
                        >
                          <span className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${confirmationDotColor(route.driverConfirmation)}`} />
                          <div className="font-medium truncate pr-2">{route.name}</div>
                          <div className="truncate text-muted-foreground">{route.startTime}</div>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

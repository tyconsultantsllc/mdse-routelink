"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface SeriesDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seriesId: string | null
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function SeriesDetailModal({ open, onOpenChange, seriesId }: SeriesDetailModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (!open || !seriesId) return
    const load = async () => {
      setLoading(true)
      try {
        const { getRouteSeriesDetails } = await import("@/app/actions/data-actions")
        const result = await getRouteSeriesDetails(seriesId)
        setData(result)
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, seriesId])

  const confirmationColor = (c: string) =>
    c === "confirmed"
      ? "bg-green-100 text-green-800"
      : c === "declined"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800"

  const statusColor = (s: string) =>
    s === "completed"
      ? "bg-green-100 text-green-800"
      : s === "in-progress"
        ? "bg-blue-100 text-blue-800"
        : s === "failed"
          ? "bg-red-100 text-red-800"
          : "bg-gray-100 text-gray-800"

  const summary = data
    ? data.occurrences.reduce(
        (acc: any, o: any) => {
          acc[o.driverConfirmation] = (acc[o.driverConfirmation] || 0) + 1
          return acc
        },
        { confirmed: 0, pending: 0, declined: 0 },
      )
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{data?.series.name || "Recurring Route"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Could not load this series.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Driver</p>
                <p className="font-medium">{data.series.driverName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Repeats On</p>
                <p className="font-medium">{data.series.daysOfWeek.map((d: number) => dayNames[d]).join(", ")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date Range</p>
                <p className="font-medium">
                  {data.series.seriesStartDate} - {data.series.seriesEndDate}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stops per Occurrence</p>
                <p className="font-medium">{data.series.stopCount}</p>
              </div>
            </div>

            {summary && (
              <div className="flex items-center gap-3 text-xs p-3 bg-muted/50 rounded-lg">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-500" /> {summary.confirmed} Confirmed
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> {summary.pending} Pending
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> {summary.declined} Declined
                </span>
                <span className="text-muted-foreground ml-auto">{data.occurrences.length} total</span>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Occurrences</p>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {data.occurrences.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 p-2 border rounded-md text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {new Date(o.startTime).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      {o.declinedReason && (
                        <p className="text-xs text-red-700 truncate">Declined: {o.declinedReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={statusColor(o.status)}>
                        {o.status === "in-progress" ? "In Progress" : o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                      </Badge>
                      <Badge className={confirmationColor(o.driverConfirmation)}>
                        {o.driverConfirmation.charAt(0).toUpperCase() + o.driverConfirmation.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

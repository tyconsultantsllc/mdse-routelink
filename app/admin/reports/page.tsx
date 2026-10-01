"use client"

import { Truck, CheckCircle, Clock, TrendingUp, FileDown } from 'lucide-react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { RefreshButton } from "@/components/refresh-button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Line, LineChart, Bar, BarChart, Pie, PieChart, XAxis, YAxis, CartesianGrid, Cell } from "recharts"
import { ExportDialog } from "@/components/export-dialog"
import { RegionFilter } from "@/components/region-filter"
import { getDriverDetails } from "@/lib/region-utils"
import { useState, useEffect } from "react"
import { getDashboardStats, getUsers, getPharmacies } from "@/app/actions/data-actions"
import { calculateOnTimeRate, isDeliveryOnTime, DEFAULT_ON_TIME_GRACE_PERIOD_MINUTES } from "@/lib/delivery-metrics"
import { useToast } from "@/components/ui/use-toast"

type DateRangeOption = "7days" | "30days" | "month" | "all"

export default function Reports() {
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [selectedRegion, setSelectedRegion] = useState("all")
  // Was rendered but never wired to anything - every choice silently showed
  // all-time numbers. Now actually filters the stats below.
  const [dateRange, setDateRange] = useState<DateRangeOption>("all")
  const { toast } = useToast()

  const [gracePeriod, setGracePeriod] = useState(DEFAULT_ON_TIME_GRACE_PERIOD_MINUTES)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchStats()
    } finally {
      setRefreshing(false)
    }
  }

  const fetchStats = async () => {
    try {
      const [dashboardStats, users, pharmacies] = await Promise.all([getDashboardStats(), getUsers(), getPharmacies()])
      setStats({ ...dashboardStats, users, pharmacies })

      const { getAppSetting } = await import("@/lib/app-settings")
      const systemSettings = await getAppSetting<{ onTimeGracePeriodMinutes?: number }>("system_settings")
      if (systemSettings?.onTimeGracePeriodMinutes != null) {
        setGracePeriod(systemSettings.onTimeGracePeriodMinutes)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      toast({
        title: 'Error',
        description: 'Failed to load report data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const driverRegionById = new Map(
    (stats?.users || []).filter((u: any) => u.role === 'driver').map((u: any) => [u.id, getDriverDetails(u)?.region]),
  )
  // Region filter only. Used as-is for the "Deliveries Over Time" chart below,
  // which always shows the last 7 months regardless of the date-range quick
  // filter - narrowing a multi-month trend chart down to "Last 7 Days" isn't
  // useful, so that one chart intentionally ignores dateRange.
  const regionFilteredLogs =
    selectedRegion === "all"
      ? stats?.logs || []
      : (stats?.logs || []).filter((log: any) => driverRegionById.get(log.driver_id) === selectedRegion)

  // The date-range quick filter above the page: turns each option into an
  // actual [start, end) window instead of being purely decorative.
  const getRangeBounds = (range: DateRangeOption): { start: Date | null; end: Date } => {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    if (range === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end }
    if (range === "all") return { start: null, end }
    const start = new Date(end)
    start.setDate(start.getDate() - (range === "7days" ? 6 : 29))
    start.setHours(0, 0, 0, 0)
    return { start, end }
  }
  const currentBounds = getRangeBounds(dateRange)
  // A "previous period" of the same duration immediately before the current
  // one, so the trend lines below are a real computed comparison rather than
  // a hardcoded string. Not exact calendar months for "This Month," but
  // always an honest apples-to-apples comparison of two equal-length windows.
  const previousBounds = currentBounds.start
    ? (() => {
        const durationMs = currentBounds.end.getTime() - currentBounds.start!.getTime()
        const end = new Date(currentBounds.start!.getTime() - 1)
        const start = new Date(end.getTime() - durationMs)
        return { start, end }
      })()
    : null
  const inRange = (log: any, bounds: { start: Date | null; end: Date }) => {
    const t = new Date(log.timestamp).getTime()
    return t <= bounds.end.getTime() && (bounds.start === null || t >= bounds.start.getTime())
  }
  const periodLogs = regionFilteredLogs.filter((log: any) => inRange(log, currentBounds))
  const previousPeriodLogs = previousBounds ? regionFilteredLogs.filter((log: any) => inRange(log, previousBounds)) : null

  const totalDeliveries = periodLogs.length
  const failedDeliveries = periodLogs.filter((log: any) => log.action === 'failed').length
  const successfulDeliveries = periodLogs.filter((log: any) => log.action === 'delivered').length

  const routesById = new Map<string, { end_time: string | null }>(
    (stats?.routes || []).map((r: any) => [r.id, { end_time: r.end_time }]),
  )
  const onTimeRate = periodLogs.length ? calculateOnTimeRate(periodLogs, routesById, gracePeriod) : 0
  const avgDeliveryTime = 0 // no reliable duration data source yet - see notes on the Performance page

  // Real "vs previous period" trend text for a stat card, or null when
  // there's nothing honest to compare against (All Time selected, so there
  // is no bounded previous period, or that previous period had zero
  // deliveries and a percentage change would be undefined/infinite).
  const formatTrend = (current: number, previous: number | null) => {
    if (previous === null || previous === 0) return null
    const change = Math.round(((current - previous) / previous) * 100)
    if (change === 0) return { text: "No change from previous period", positive: true }
    return { text: `${change > 0 ? "+" : ""}${change}% from previous period`, positive: change > 0 }
  }
  const deliveriesTrend = formatTrend(totalDeliveries, previousPeriodLogs ? previousPeriodLogs.length : null)
  const previousOnTimeRate =
    previousPeriodLogs && previousPeriodLogs.length ? calculateOnTimeRate(previousPeriodLogs, routesById, gracePeriod) : null
  // On-time rate is itself a percentage, so the honest comparison is a
  // percentage-POINT difference, not a "percent change of a percent".
  const onTimeTrend =
    previousOnTimeRate === null
      ? null
      : (() => {
          const diff = Math.round(onTimeRate - previousOnTimeRate)
          if (diff === 0) return { text: "No change from previous period", positive: true }
          return { text: `${diff > 0 ? "+" : ""}${diff} pts from previous period`, positive: diff > 0 }
        })()

  // Real month-by-month counts from actual delivery log timestamps, instead
  // of hardcoded zeros with all volume dumped into a single fake month
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const now = new Date()
  const deliveriesData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1)
    const count = regionFilteredLogs.filter((log: any) => {
      const logDate = new Date(log.timestamp)
      return logDate.getFullYear() === d.getFullYear() && logDate.getMonth() === d.getMonth()
    }).length
    return { month: monthNames[d.getMonth()], deliveries: count }
  })

  const onTimeDeliveredCount = periodLogs.filter(
    (log: any) => log.action === 'delivered' && isDeliveryOnTime(log.timestamp, routesById.get(log.route_id)?.end_time, gracePeriod) === true,
  ).length
  const lateDeliveredCount = successfulDeliveries - onTimeDeliveredCount

  const statusData = [
    { name: "On Time", value: onTimeDeliveredCount, color: "#10b981" },
    { name: "Late", value: lateDeliveredCount, color: "#f59e0b" },
    { name: "Failed", value: failedDeliveries, color: "#ef4444" },
  ]

  const driversData = stats?.users
    ?.filter((u: any) => u.role === 'driver' && (selectedRegion === "all" || getDriverDetails(u)?.region === selectedRegion))
    .map((driver: any) => ({
      name: `${driver.first_name} ${driver.last_name}`,
      deliveries: periodLogs.filter((log: any) => log.driver_id === driver.id).length
    })) || []

  const pharmaciesData = (stats?.pharmacies || [])
    .filter((pharmacy: any) => selectedRegion === "all" || pharmacy.region === selectedRegion)
    .map((pharmacy: any) => ({
      name: pharmacy.name,
      deliveries: periodLogs.filter((log: any) => log.pharmacy_id === pharmacy.id).length,
    }))

  const driverNameById = new Map((stats?.users || []).filter((u: any) => u.role === 'driver').map((u: any) => [u.id, `${u.first_name} ${u.last_name}`]))
  const pharmacyNameById = new Map((stats?.pharmacies || []).map((p: any) => [p.id, p.name]))

  const exportData = {
    stats: [
      { label: "Total Deliveries", value: totalDeliveries.toLocaleString() },
      { label: "On-Time Rate", value: `${onTimeRate}%` },
      { label: "Avg Delivery Time", value: `${avgDeliveryTime} min` },
    ],
    headers: ["Date", "Driver", "Pharmacy", "Status"],
    rows: periodLogs.map((log: any) => [
      new Date(log.timestamp).toLocaleString(),
      driverNameById.get(log.driver_id) || "Unknown",
      pharmacyNameById.get(log.pharmacy_id) || "Unknown",
      log.action === 'delivered' ? 'Delivered' : log.action === 'failed' ? 'Failed' : log.action,
    ]),
    deliveries: deliveriesData,
    drivers: driversData,
    pharmacies: pharmaciesData,
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden pt-16 md:pt-0">
          <AdminHeader title="Analytics Reports">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <RegionFilter value={selectedRegion} onChange={setSelectedRegion} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setExportDialogOpen(true)}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export report as PDF or CSV</TooltipContent>
            </Tooltip>
            <RefreshButton onRefresh={handleRefresh} refreshing={refreshing} />
          </AdminHeader>

          <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto p-4 md:p-6">
            {loading ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">Loading report data...</p>
              </Card>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="p-6 cursor-help hover:shadow-lg transition-shadow">
                        <div className="flex items-center">
                          <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                            <Truck className="h-6 w-6" />
                          </div>
                          <div className="ml-4 flex-1">
                            <p className="text-sm font-medium text-muted-foreground">Total Deliveries</p>
                            <p className="text-2xl font-bold text-foreground">{totalDeliveries.toLocaleString()}</p>
                            {deliveriesTrend && (
                              <div
                                className={`flex items-center text-xs mt-1 ${deliveriesTrend.positive ? "text-green-600" : "text-red-600"}`}
                              >
                                <TrendingUp className={`h-3 w-3 mr-1 ${deliveriesTrend.positive ? "" : "rotate-180"}`} />
                                <span>{deliveriesTrend.text}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>Total number of deliveries completed</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="p-6 cursor-help hover:shadow-lg transition-shadow">
                        <div className="flex items-center">
                          <div className="p-3 rounded-full bg-green-100 text-green-600">
                            <CheckCircle className="h-6 w-6" />
                          </div>
                          <div className="ml-4 flex-1">
                            <p className="text-sm font-medium text-muted-foreground">On-Time Rate</p>
                            <p className="text-2xl font-bold text-foreground">{onTimeRate}%</p>
                            {onTimeTrend && (
                              <div
                                className={`flex items-center text-xs mt-1 ${onTimeTrend.positive ? "text-green-600" : "text-red-600"}`}
                              >
                                <TrendingUp className={`h-3 w-3 mr-1 ${onTimeTrend.positive ? "" : "rotate-180"}`} />
                                <span>{onTimeTrend.text}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>Percentage of deliveries completed on time</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="p-6 cursor-help hover:shadow-lg transition-shadow">
                        <div className="flex items-center">
                          <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                            <Clock className="h-6 w-6" />
                          </div>
                          <div className="ml-4 flex-1">
                            <p className="text-sm font-medium text-muted-foreground">Avg Delivery Time</p>
                            {/* No reliable duration data source yet (same
                                honest N/A used on the Performance page) -
                                this used to show a hardcoded "28 min" with a
                                fake "2 min from last month" trend. */}
                            <p className="text-2xl font-bold text-foreground">N/A</p>
                          </div>
                        </div>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>Average time to complete a delivery</TooltipContent>
                  </Tooltip>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <Card className="p-6 hover:shadow-lg transition-shadow">
                    <h2 className="text-lg font-medium text-foreground mb-4">Deliveries Over Time</h2>
                    <ChartContainer
                      config={{
                        deliveries: {
                          label: "Deliveries",
                          color: "hsl(var(--chart-1))",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <LineChart data={deliveriesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line
                          type="monotone"
                          dataKey="deliveries"
                          stroke="var(--color-deliveries)"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ChartContainer>
                  </Card>

                  <Card className="p-6 hover:shadow-lg transition-shadow">
                    <h2 className="text-lg font-medium text-foreground mb-4">Delivery Status Distribution</h2>
                    <ChartContainer
                      config={{
                        onTime: {
                          label: "On Time",
                          color: "#10b981",
                        },
                        delayed: {
                          label: "Delayed",
                          color: "#f59e0b",
                        },
                        failed: {
                          label: "Failed",
                          color: "#ef4444",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <PieChart>
                        <Pie
                          data={statusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                      </PieChart>
                    </ChartContainer>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6 hover:shadow-lg transition-shadow">
                    <h2 className="text-lg font-medium text-foreground mb-4">Top Performing Drivers</h2>
                    <ChartContainer
                      config={{
                        deliveries: {
                          label: "Deliveries",
                          color: "hsl(var(--chart-1))",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <BarChart data={driversData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="deliveries" fill="var(--color-deliveries)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </Card>

                  <Card className="p-6 hover:shadow-lg transition-shadow">
                    <h2 className="text-lg font-medium text-foreground mb-4">Top Pharmacy Locations</h2>
                    <ChartContainer
                      config={{
                        deliveries: {
                          label: "Deliveries",
                          color: "hsl(var(--chart-2))",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <BarChart data={pharmaciesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="deliveries" fill="var(--color-deliveries)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </Card>
                </div>
              </>
            )}
          </PullToRefresh>
        </div>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        reportType="deliveries"
        data={exportData}
      />
    </TooltipProvider>
  )
}

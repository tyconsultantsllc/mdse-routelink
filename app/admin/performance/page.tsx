"use client"

import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, Award, Clock, Truck, CheckCircle, AlertTriangle } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { useState, useEffect } from "react"
import { getDashboardStats, getUsers } from "@/app/actions/data-actions"
import { calculateOnTimeRate, DEFAULT_ON_TIME_GRACE_PERIOD_MINUTES } from "@/lib/delivery-metrics"
import { useToast } from "@/components/ui/use-toast"

export default function PerformanceDashboard() {
  const [timeRange, setTimeRange] = useState("30")
  const [driverPerformance, setDriverPerformance] = useState<any[]>([])
  const [allLogs, setAllLogs] = useState<any[]>([])
  const [allRoutes, setAllRoutes] = useState<any[]>([])
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(DEFAULT_ON_TIME_GRACE_PERIOD_MINUTES)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchPerformanceData()
  }, [timeRange])

  const fetchPerformanceData = async () => {
    try {
      const [stats, users] = await Promise.all([getDashboardStats(), getUsers()])

      const { getAppSetting } = await import("@/lib/app-settings")
      const systemSettings = await getAppSetting<{ onTimeGracePeriodMinutes?: number }>("system_settings")
      const gracePeriod = systemSettings?.onTimeGracePeriodMinutes ?? DEFAULT_ON_TIME_GRACE_PERIOD_MINUTES

      const routesById = new Map(stats.routes.map((r: any) => [r.id, { end_time: r.end_time }]))

      // Calculate performance metrics for drivers
      const now = new Date()
      const drivers = users.filter((u: any) => u.role === 'driver')
      const performance = drivers.map((driver: any) => {
        const driverLogs = stats.logs.filter((log: any) => log.driver_id === driver.id)
        const driverRoutes = stats.routes.filter((route: any) => route.driver_id === driver.id)

        const thisMonthCount = driverLogs.filter((log: any) => {
          const d = new Date(log.timestamp)
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
        }).length
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthCount = driverLogs.filter((log: any) => {
          const d = new Date(log.timestamp)
          return d.getFullYear() === lastMonthDate.getFullYear() && d.getMonth() === lastMonthDate.getMonth()
        }).length

        return {
          id: driver.id,
          name: `${driver.first_name} ${driver.last_name}`,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${driver.id}`,
          totalDeliveries: driverLogs.length,
          onTimeRate: calculateOnTimeRate(driverLogs, routesById, gracePeriod),
          avgDeliveryTime: 0, // no reliable duration data source yet
          customerRating: 0, // no ratings system exists yet
          trend: thisMonthCount >= lastMonthCount ? 'up' : 'down',
        }
      })
      
      setDriverPerformance(performance)
      setAllLogs(stats.logs || [])
      setAllRoutes(stats.routes || [])
      setGracePeriodMinutes(gracePeriod)
    } catch (error) {
      console.error('Error fetching performance data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load performance data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const totalDeliveries = driverPerformance.reduce((sum, d) => sum + d.totalDeliveries, 0)
  const avgOnTimeRate = driverPerformance.length > 0 
    ? Math.round(driverPerformance.reduce((sum, d) => sum + d.onTimeRate, 0) / driverPerformance.length)
    : 0
  const avgDeliveryTime = driverPerformance.length > 0
    ? Math.round(driverPerformance.reduce((sum, d) => sum + d.avgDeliveryTime, 0) / driverPerformance.length)
    : 0
  const topPerformer = [...driverPerformance].sort((a, b) => b.onTimeRate - a.onTimeRate)[0]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const today = new Date()
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    const dayLogs = allLogs.filter((log: any) => new Date(log.timestamp).toDateString() === d.toDateString())
    return {
      day: dayNames[d.getDay()],
      deliveries: dayLogs.filter((l: any) => l.action === 'delivered').length,
      onTime: dayLogs.filter((l: any) => l.action === 'failed').length,
    }
  })

  const deliveredCount = allLogs.filter((l: any) => l.action === 'delivered').length
  const failedCount = allLogs.filter((l: any) => l.action === 'failed').length
  const deliveryStatusData = [
    { name: "Delivered", value: deliveredCount, color: "#22c55e" },
    { name: "Failed", value: failedCount, color: "#ef4444" },
  ]

  // avgTime is intentionally left at 0, not fabricated - no reliable
  // duration data source exists yet. onTimeRate now uses the real
  // calculation now that a grace-period definition exists.
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const routesByIdForTrend = new Map(allRoutes.map((r: any) => [r.id, { end_time: r.end_time }]))
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1)
    const monthLogs = allLogs.filter((log: any) => {
      const logDate = new Date(log.timestamp)
      return logDate.getFullYear() === d.getFullYear() && logDate.getMonth() === d.getMonth()
    })
    return {
      month: monthNames[d.getMonth()],
      avgTime: 0,
      onTimeRate: calculateOnTimeRate(monthLogs, routesByIdForTrend, gracePeriodMinutes),
    }
  })

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />

      <div className="flex flex-col flex-1 overflow-hidden pt-16 md:pt-0">
        <AdminHeader title="Driver Performance" />

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Time Range Selector */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Performance Metrics</h2>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Loading performance data...</p>
            </Card>
          ) : driverPerformance.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No driver performance data available yet.</p>
            </Card>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Deliveries</p>
                      <p className="text-3xl font-bold text-foreground mt-2">{totalDeliveries}</p>
                    </div>
                    <div className="p-3 rounded-full bg-blue-100">
                      <Truck className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">On-Time Rate</p>
                      <p className="text-3xl font-bold text-foreground mt-2">{avgOnTimeRate}%</p>
                    </div>
                    <div className="p-3 rounded-full bg-green-100">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Delivery Time</p>
                      <p className="text-3xl font-bold text-foreground mt-2">N/A</p>
                    </div>
                    <div className="p-3 rounded-full bg-yellow-100">
                      <Clock className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Top Performer</p>
                      <p className="text-lg font-bold text-foreground mt-2">{topPerformer?.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">{topPerformer?.onTimeRate}% on-time</p>
                    </div>
                    <div className="p-3 rounded-full bg-purple-100">
                      <Award className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </Card>
              </div>

              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="drivers">Driver Rankings</TabsTrigger>
                  <TabsTrigger value="trends">Trends</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold mb-4">Weekly Delivery Performance</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={weeklyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="deliveries" fill="#3b82f6" name="Delivered" />
                          <Bar dataKey="onTime" fill="#ef4444" name="Failed" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>

                    <Card className="p-6">
                      <h3 className="text-lg font-semibold mb-4">Delivery Status Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={deliveryStatusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {deliveryStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>

                  {/* Monthly Trend */}
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">6-Month Performance Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="avgTime"
                          stroke="#f59e0b"
                          name="Avg Time (min)"
                          strokeWidth={2}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="onTimeRate"
                          stroke="#22c55e"
                          name="On-Time Rate (%)"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                </TabsContent>

                <TabsContent value="drivers">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Driver Performance Rankings</h3>
                    <div className="space-y-4">
                      {[...driverPerformance].sort((a, b) => b.onTimeRate - a.onTimeRate).map((driver, index) => (
                        <div
                          key={driver.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 font-bold text-primary">
                              {index + 1}
                            </div>
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={driver.avatar || "/placeholder.svg"} />
                              <AvatarFallback>{driver.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-foreground">{driver.name}</p>
                              <p className="text-sm text-muted-foreground">{driver.totalDeliveries} total deliveries</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">On-Time Rate</p>
                              <div className="flex items-center gap-1 mt-1">
                                <p className="text-lg font-bold">{driver.onTimeRate}%</p>
                                {driver.trend === "up" ? (
                                  <TrendingUp className="h-4 w-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-600" />
                                )}
                              </div>
                            </div>

                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Avg Time</p>
                              <p className="text-lg font-bold mt-1">N/A</p>
                            </div>

                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Rating</p>
                              <p className="text-lg font-bold mt-1">No ratings yet</p>
                            </div>

                            <Badge
                              className={
                                driver.onTimeRate >= 95
                                  ? "bg-green-100 text-green-800"
                                  : driver.onTimeRate >= 90
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-orange-100 text-orange-800"
                              }
                            >
                              {driver.onTimeRate >= 95
                                ? "Excellent"
                                : driver.onTimeRate >= 90
                                  ? "Good"
                                  : "Needs Improvement"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="trends">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold mb-4">Performance Alerts</h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-green-900">On-time rate improving</p>
                            <p className="text-sm text-green-700">Team average increased by 3% this month</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-yellow-900">Weekend performance lower</p>
                            <p className="text-sm text-yellow-700">Saturday/Sunday deliveries 8% slower on average</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                          <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-blue-900">Peak hours identified</p>
                            <p className="text-sm text-blue-700">Best performance between 9 AM - 2 PM</p>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6">
                      <h3 className="text-lg font-semibold mb-4">Improvement Recommendations</h3>
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg border">
                          <p className="font-medium">Route Optimization</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Consider adjusting routes during peak traffic hours to maintain delivery times
                          </p>
                        </div>

                        <div className="p-3 rounded-lg border">
                          <p className="font-medium">Training Focus</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Provide additional training for drivers with on-time rates below 90%
                          </p>
                        </div>

                        <div className="p-3 rounded-lg border">
                          <p className="font-medium">Resource Allocation</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Add 1-2 drivers during Thursday-Friday peak periods
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

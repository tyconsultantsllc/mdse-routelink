"use client"

import { Truck, CheckCircle, Clock, TrendingUp, FileDown } from 'lucide-react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Line, LineChart, Bar, BarChart, Pie, PieChart, XAxis, YAxis, CartesianGrid, Cell } from "recharts"
import { ExportDialog } from "@/components/export-dialog"
import { useState, useEffect } from "react"
import { getDashboardStats, getUsers } from "@/app/actions/data-actions"
import { useToast } from "@/components/ui/use-toast"

export default function Reports() {
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const [dashboardStats, users] = await Promise.all([getDashboardStats(), getUsers()])
      setStats({ ...dashboardStats, users })
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

  const totalDeliveries = stats?.logs?.length || 0
  const onTimeRate = 0 // Would need actual on-time data
  const avgDeliveryTime = 0 // Would need actual time data

  const deliveriesData = [
    { month: "Jan", deliveries: 0 },
    { month: "Feb", deliveries: 0 },
    { month: "Mar", deliveries: 0 },
    { month: "Apr", deliveries: 0 },
    { month: "May", deliveries: 0 },
    { month: "Jun", deliveries: 0 },
    { month: "Jul", deliveries: totalDeliveries },
  ]

  const statusData = [
    { name: "On Time", value: totalDeliveries, color: "#10b981" },
    { name: "Delayed", value: 0, color: "#f59e0b" },
    { name: "Failed", value: 0, color: "#ef4444" },
  ]

  const driversData = stats?.users
    ?.filter((u: any) => u.role === 'driver')
    .map((driver: any) => ({
      name: `${driver.first_name} ${driver.last_name}`,
      deliveries: stats.logs.filter((log: any) => log.driver_id === driver.id).length
    })) || []

  const pharmaciesData: any[] = [] // Would need to aggregate by pharmacy

  const exportData = {
    stats: [
      { label: "Total Deliveries", value: totalDeliveries.toLocaleString() },
      { label: "On-Time Rate", value: `${onTimeRate}%` },
      { label: "Avg Delivery Time", value: `${avgDeliveryTime} min` },
    ],
    headers: ["Month", "Deliveries", "Status", "Driver", "Pharmacy"],
    rows: [],
    deliveries: deliveriesData,
    drivers: driversData,
    pharmacies: pharmaciesData,
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar />

        <div className="flex flex-col flex-1 overflow-hidden pt-16 md:pt-0">
          <AdminHeader title="Analytics Reports">
            <Select defaultValue="all">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setExportDialogOpen(true)}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export report as PDF or CSV</TooltipContent>
            </Tooltip>
          </AdminHeader>

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
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
                            {/* */}
                            <div className="flex items-center text-xs text-green-600 mt-1">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              <span>12% from last month</span>
                            </div>
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
                            {/* */}
                            <div className="flex items-center text-xs text-green-600 mt-1">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              <span>3% from last month</span>
                            </div>
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
                            <p className="text-2xl font-bold text-foreground">28 min</p>
                            <div className="flex items-center text-xs text-red-600 mt-1">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              <span>2 min from last month</span>
                            </div>
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
          </div>
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

"use client"

import { useState, useEffect } from "react"
import { DollarSign } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { getRoutes, getUsers } from "@/app/actions/data-actions"

export default function PayrollSummaryPage() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDriverId, setSelectedDriverId] = useState<string>("")
  const [payPeriodStart, setPayPeriodStart] = useState("")
  const [payPeriodEnd, setPayPeriodEnd] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [routesData, usersData] = await Promise.all([getRoutes(), getUsers()])
      setRoutes(routesData || [])
      setDrivers(usersData.filter((u: any) => u.role === "driver"))
    } catch (error) {
      console.error("Error fetching payroll data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Only completed routes count toward pay, filtered to when the route was
  // actually finished (falls back to scheduled start if actual_end_time
  // isn't set, so a completed route with missing data doesn't just vanish).
  const relevantRoutes = routes.filter((r: any) => {
    if (r.status !== "completed") return false
    if (selectedDriverId && r.driver_id !== selectedDriverId) return false

    const dateStr = r.actual_end_time || r.start_time
    if (!dateStr) return false
    const date = new Date(dateStr)

    if (payPeriodStart && date < new Date(payPeriodStart)) return false
    if (payPeriodEnd && date > new Date(`${payPeriodEnd}T23:59:59`)) return false

    return true
  })

  const fourHourCount = relevantRoutes.filter((r: any) => r.pay_route_type === "4_hour").length
  const sixHourCount = relevantRoutes.filter((r: any) => r.pay_route_type === "6_hour").length
  const unclassifiedCount = relevantRoutes.filter((r: any) => !r.pay_route_type).length
  const lateNightCount = relevantRoutes.filter((r: any) => r.is_late_night).length
  const highVolumeCount = relevantRoutes.filter((r: any) => r.is_high_volume).length

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminHeader title="Payroll Summary" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">Payroll Summary</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Real counts for the paystub generator - pick a driver and pay period below.
            </p>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Driver</Label>
                  <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.first_name} {driver.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pay Period Start</Label>
                  <Input type="date" value={payPeriodStart} onChange={(e) => setPayPeriodStart(e.target.value)} />
                </div>
                <div>
                  <Label>Pay Period End</Label>
                  <Input type="date" value={payPeriodEnd} onChange={(e) => setPayPeriodEnd(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </Card>
          ) : !selectedDriverId ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Select a driver to see their route counts.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">4-Hour Routes</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{fourHourCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">6-Hour Routes</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{sixHourCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Late Night Routes</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{lateNightCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">High Volume Routes</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{highVolumeCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Completed Routes</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{relevantRoutes.length}</p>
                </CardContent>
              </Card>
              {unclassifiedCount > 0 && (
                <Card className="border-yellow-300">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Unclassified</CardTitle>
                    <Badge variant="outline" className="text-yellow-700 border-yellow-400">
                      Needs review
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{unclassifiedCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Completed routes with no Pay Route Type set - won't show up in either bucket above.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {selectedDriverId && relevantRoutes.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Routes in This Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {relevantRoutes.map((route: any) => (
                    <div key={route.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                      <div>
                        <span className="font-medium">{route.name}</span>
                        <span className="text-muted-foreground ml-2">
                          {new Date(route.actual_end_time || route.start_time).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {route.pay_route_type === "4_hour" && <Badge variant="secondary">4-Hour</Badge>}
                        {route.pay_route_type === "6_hour" && <Badge variant="secondary">6-Hour</Badge>}
                        {!route.pay_route_type && <Badge variant="outline">Unclassified</Badge>}
                        {route.is_late_night && <Badge className="bg-indigo-100 text-indigo-800">Late Night</Badge>}
                        {route.is_high_volume && <Badge className="bg-orange-100 text-orange-800">High Volume</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { DollarSign, Printer, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { getRoutes, getUsers } from "@/app/actions/data-actions"
import { RegionFilter } from "@/components/region-filter"
import { generatePaystubHTML, printReport, exportToCSV } from "@/lib/export-utils"
import { getAppSetting, setAppSetting } from "@/lib/app-settings"

const DEFAULT_RATES = {
  fourHourRate: 80,
  sixHourRate: 120,
  lateNightRate: 20,
  highVolumeRate: 20,
  pickUpRate: 17.5,
  gasRate: 20,
  mileRate: 1.2,
  lostPackageRate: 25,
}

export default function PayrollSummaryPage() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDriverId, setSelectedDriverId] = useState<string>("")
  const [selectedRegion, setSelectedRegion] = useState<string>("all")
  const [payPeriodStart, setPayPeriodStart] = useState("")
  const [payPeriodEnd, setPayPeriodEnd] = useState("")
  const { toast } = useToast()

  // Paystub-only fields - never persisted (SSN especially shouldn't be
  // stored), re-entered each time exactly like the standalone tool
  const [ssnLast4, setSsnLast4] = useState("")
  const [address, setAddress] = useState("")
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState(
    "This payment is for services rendered as an independent contractor. No taxes have been withheld.",
  )

  // Rates default from a saved system setting so they don't need retyping
  // every pay period, but stay editable per-stub for one-off adjustments
  const [rates, setRates] = useState(DEFAULT_RATES)
  const [pickUpCount, setPickUpCount] = useState(0)
  const [gasCount, setGasCount] = useState(0)
  const [milesCount, setMilesCount] = useState(0)
  const [cashAdvance, setCashAdvance] = useState(0)
  const [lostPackagesCount, setLostPackagesCount] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!selectedDriverId) {
      setAddress("")
      setSsnLast4("")
      return
    }
    const loadPayrollInfo = async () => {
      try {
        const { getDriverPayrollInfo } = await import("@/app/actions/data-actions")
        const info = await getDriverPayrollInfo(selectedDriverId)
        setAddress(info?.address || "")
        setSsnLast4(info?.ssn_last4 || "")
      } catch (error) {
        console.error("Error loading saved payroll info:", error)
      }
    }
    loadPayrollInfo()
  }, [selectedDriverId])

  const fetchData = async () => {
    try {
      const [routesData, usersData, savedRates] = await Promise.all([
        getRoutes(),
        getUsers(),
        getAppSetting<typeof DEFAULT_RATES>("payroll_rates"),
      ])
      setRoutes(routesData || [])
      setDrivers(usersData.filter((u: any) => u.role === "driver"))
      if (savedRates) setRates({ ...DEFAULT_RATES, ...savedRates })
    } catch (error) {
      console.error("Error fetching payroll data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRatesAsDefault = async () => {
    try {
      await setAppSetting("payroll_rates", rates)
      toast({ title: "Default rates saved", description: "These rates will pre-fill on future paystubs." })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleSaveDriverInfo = async () => {
    if (!selectedDriverId) return
    try {
      const { saveDriverPayrollInfo } = await import("@/app/actions/data-actions")
      await saveDriverPayrollInfo(selectedDriverId, address, ssnLast4)
      toast({ title: "Saved", description: "This driver's info will auto-fill next time." })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  // Only completed routes count toward pay, filtered to when the route was
  // actually finished (falls back to scheduled start if actual_end_time
  // isn't set, so a completed route with missing data doesn't just vanish).
  const filteredDriversForDropdown =
    selectedRegion === "all" ? drivers : drivers.filter((d: any) => d.drivers?.[0]?.region === selectedRegion)

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

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId)
  const driverName = selectedDriver ? `${selectedDriver.first_name} ${selectedDriver.last_name}` : ""

  const routeItems = [
    { label: "4-Hour Routes", qty: fourHourCount, rate: rates.fourHourRate },
    { label: "6-Hour Routes", qty: sixHourCount, rate: rates.sixHourRate },
    { label: "Late Night Routes", qty: lateNightCount, rate: rates.lateNightRate },
    { label: "High Volume Routes", qty: highVolumeCount, rate: rates.highVolumeRate },
  ]
  const incentiveItems = [
    { label: "Pick Up", qty: pickUpCount, rate: rates.pickUpRate },
    { label: "Gas", qty: gasCount, rate: rates.gasRate },
  ]
  const statItems = [{ label: "Miles", qty: milesCount, rate: rates.mileRate }]
  const adjustmentItems = [
    { label: "Cash Advance", qty: cashAdvance, rate: 1 },
    { label: "Lost Packages", qty: lostPackagesCount, rate: -rates.lostPackageRate },
  ]

  const totalPayment = [...routeItems, ...incentiveItems, ...statItems, ...adjustmentItems].reduce(
    (sum, i) => sum + i.qty * i.rate,
    0,
  )

  const handleGeneratePaystub = () => {
    if (!selectedDriver) {
      toast({ title: "Select a driver first", variant: "destructive" })
      return
    }
    const html = generatePaystubHTML({
      driverName,
      address,
      ssnLast4,
      payPeriodStart,
      payPeriodEnd,
      paymentDate,
      routeItems,
      incentiveItems,
      statItems,
      adjustmentItems,
      notes,
    })
    printReport(html)
  }

  const handleExportCSV = () => {
    if (!selectedDriver) {
      toast({ title: "Select a driver first", variant: "destructive" })
      return
    }
    const rows = [...routeItems, ...incentiveItems, ...statItems, ...adjustmentItems]
      .filter((i) => i.qty !== 0)
      .map((i) => ({
        Driver: driverName,
        PayPeriodStart: payPeriodStart,
        PayPeriodEnd: payPeriodEnd,
        Type: i.label,
        Qty: i.qty,
        Rate: i.rate,
        Amount: (i.qty * i.rate).toFixed(2),
      }))
    exportToCSV(rows, `paystub-${driverName.replace(/\s+/g, "-")}-${payPeriodStart || "period"}`)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminHeader title="Payroll" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">Payroll</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Route counts are pulled automatically from real delivery data. Incentives, mileage, and adjustments
              still need manual entry - RouteLink doesn't track those.
            </p>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Region</Label>
                  <RegionFilter value={selectedRegion} onChange={setSelectedRegion} />
                </div>
                <div>
                  <Label>Driver</Label>
                  <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDriversForDropdown.map((driver) => (
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
            <>
              {/* Verified route counts */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
                        Completed routes with no Pay Route Type set - not counted in either bucket above.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: full paystub form */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Paystub Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">Driver Information</h4>
                        <Button variant="outline" size="sm" onClick={handleSaveDriverInfo}>
                          Save for Next Time
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Address is stored as-is. SSN is encrypted at the database level and only ever decrypted here,
                        for you, when generating this driver's stub.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>SSN (Last 4)</Label>
                          <Input value={ssnLast4} onChange={(e) => setSsnLast4(e.target.value)} maxLength={4} />
                        </div>
                        <div>
                          <Label>Payment Date</Label>
                          <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                        </div>
                      </div>
                      <div className="mt-3">
                        <Label>Address</Label>
                        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">Route Rates</h4>
                        <Button variant="outline" size="sm" onClick={handleSaveRatesAsDefault}>
                          Save as Default
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">4-Hour Rate ($)</Label>
                          <Input
                            type="number"
                            value={rates.fourHourRate}
                            onChange={(e) => setRates({ ...rates, fourHourRate: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">6-Hour Rate ($)</Label>
                          <Input
                            type="number"
                            value={rates.sixHourRate}
                            onChange={(e) => setRates({ ...rates, sixHourRate: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Late Night Rate ($)</Label>
                          <Input
                            type="number"
                            value={rates.lateNightRate}
                            onChange={(e) => setRates({ ...rates, lateNightRate: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">High Volume Rate ($)</Label>
                          <Input
                            type="number"
                            value={rates.highVolumeRate}
                            onChange={(e) => setRates({ ...rates, highVolumeRate: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">Incentives (manual entry)</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Pick Up Count</Label>
                          <Input type="number" value={pickUpCount} onChange={(e) => setPickUpCount(Number(e.target.value))} />
                        </div>
                        <div>
                          <Label className="text-xs">Pick Up Rate ($)</Label>
                          <Input
                            type="number"
                            value={rates.pickUpRate}
                            onChange={(e) => setRates({ ...rates, pickUpRate: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Gas Count</Label>
                          <Input type="number" value={gasCount} onChange={(e) => setGasCount(Number(e.target.value))} />
                        </div>
                        <div>
                          <Label className="text-xs">Gas Rate ($)</Label>
                          <Input
                            type="number"
                            value={rates.gasRate}
                            onChange={(e) => setRates({ ...rates, gasRate: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">STAT Deliveries (manual entry)</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Miles</Label>
                          <Input type="number" value={milesCount} onChange={(e) => setMilesCount(Number(e.target.value))} />
                        </div>
                        <div>
                          <Label className="text-xs">Mile Rate ($)</Label>
                          <Input
                            type="number"
                            value={rates.mileRate}
                            onChange={(e) => setRates({ ...rates, mileRate: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">Adjustments (manual entry)</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Cash Advance ($)</Label>
                          <Input
                            type="number"
                            placeholder="Positive or negative"
                            value={cashAdvance || ""}
                            onChange={(e) => setCashAdvance(Number(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Lost Packages (count)</Label>
                          <Input
                            type="number"
                            value={lostPackagesCount || ""}
                            onChange={(e) => setLostPackagesCount(Number(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Notes</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                    </div>
                  </CardContent>
                </Card>

                {/* Right: live preview + actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg p-6 bg-white text-sm space-y-4">
                      <div className="font-bold text-blue-700 text-lg">MDSCRIPTS express</div>
                      <div className="flex justify-between">
                        <div>
                          <p>
                            <span className="text-muted-foreground">Name:</span> {driverName || "—"}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Address:</span> {address || "—"}
                          </p>
                          <p>
                            <span className="text-muted-foreground">SSN (Last 4):</span> XXX-XX-{ssnLast4 || "____"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p>
                            <span className="text-muted-foreground">Pay Period:</span> {payPeriodStart || "N/A"} -{" "}
                            {payPeriodEnd || "N/A"}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Payment Date:</span> {paymentDate || "N/A"}
                          </p>
                        </div>
                      </div>

                      {[...routeItems, ...incentiveItems, ...statItems, ...adjustmentItems]
                        .filter((i) => i.qty !== 0)
                        .map((item, idx) => (
                          <div key={idx} className="flex justify-between border-b pb-1">
                            <span>
                              {item.label} ({item.qty})
                            </span>
                            <span>${(item.qty * item.rate).toFixed(2)}</span>
                          </div>
                        ))}

                      <div className="flex justify-between text-lg font-bold border-t-2 pt-2">
                        <span>TOTAL PAYMENT:</span>
                        <span>${totalPayment.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{notes}</p>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button onClick={handleGeneratePaystub} className="flex-1">
                        <Printer className="h-4 w-4 mr-2" />
                        Print / Save PDF
                      </Button>
                      <Button variant="outline" onClick={handleExportCSV} className="flex-1 bg-transparent">
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

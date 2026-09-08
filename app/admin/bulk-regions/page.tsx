"use client"

import { useState, useEffect } from "react"
import { MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { getPharmacies, getUsers } from "@/app/actions/data-actions"
import { getDriverDetails } from "@/lib/region-utils"

export default function BulkRegionAssignPage() {
  const [pharmacies, setPharmacies] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [pharmacyRegions, setPharmacyRegions] = useState<Record<string, string>>({})
  const [driverRegions, setDriverRegions] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [pharmaciesData, usersData] = await Promise.all([getPharmacies(), getUsers()])
      const driversData = usersData.filter((u: any) => u.role === "driver")

      setPharmacies(pharmaciesData)
      setDrivers(driversData)

      setPharmacyRegions(Object.fromEntries(pharmaciesData.map((p: any) => [p.id, p.region || "none"])))
      setDriverRegions(
        Object.fromEntries(driversData.map((d: any) => [d.id, getDriverDetails(d)?.region || "none"])),
      )
    } catch (error) {
      console.error("Error loading regions:", error)
      toast({ title: "Error", description: "Failed to load pharmacies and drivers", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      const supabase = createClient()
      const { updateUser } = await import("@/app/actions/data-actions")

      // Only pharmacies/drivers whose region actually changed get written -
      // no need to touch rows that are already correct.
      const changedPharmacies = pharmacies.filter(
        (p) => (pharmacyRegions[p.id] || "none") !== (p.region || "none"),
      )
      const changedDrivers = drivers.filter(
        (d) => (driverRegions[d.id] || "none") !== (getDriverDetails(d)?.region || "none"),
      )

      for (const pharmacy of changedPharmacies) {
        const region = pharmacyRegions[pharmacy.id]
        const { error } = await supabase
          .from("pharmacies")
          .update({ region: region === "none" ? null : region })
          .eq("id", pharmacy.id)
        if (error) throw error
      }

      for (const driver of changedDrivers) {
        const region = driverRegions[driver.id]
        // updateUser only writes fields that are actually passed - leaving
        // name/phone/vehicle fields out here doesn't touch or clear them.
        await updateUser(driver.id, { region: region === "none" ? undefined : region })
      }

      toast({
        title: "Saved",
        description: `Updated ${changedPharmacies.length + changedDrivers.length} record${changedPharmacies.length + changedDrivers.length === 1 ? "" : "s"}.`,
      })
      fetchData()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save changes", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const RegionSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No region</SelectItem>
        <SelectItem value="socal">Southern California</SelectItem>
        <SelectItem value="minnesota">Minnesota</SelectItem>
      </SelectContent>
    </Select>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminHeader title="Bulk Region Assignment" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Bulk Region Assignment</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Set the region for every pharmacy and driver at once, instead of editing them one at a time.
              </p>
            </div>
            <Button onClick={handleSaveAll} disabled={isSaving || loading}>
              {isSaving ? "Saving..." : "Save All"}
            </Button>
          </div>

          {loading ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Pharmacies ({pharmacies.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pharmacies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pharmacies yet.</p>
                  ) : (
                    pharmacies.map((pharmacy) => (
                      <div key={pharmacy.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{pharmacy.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{pharmacy.address}</p>
                        </div>
                        <RegionSelect
                          value={pharmacyRegions[pharmacy.id] || "none"}
                          onChange={(v) => setPharmacyRegions({ ...pharmacyRegions, [pharmacy.id]: v })}
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Drivers ({drivers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {drivers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No drivers yet.</p>
                  ) : (
                    drivers.map((driver) => (
                      <div key={driver.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {driver.first_name} {driver.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{driver.email}</p>
                        </div>
                        <RegionSelect
                          value={driverRegions[driver.id] || "none"}
                          onChange={(v) => setDriverRegions({ ...driverRegions, [driver.id]: v })}
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

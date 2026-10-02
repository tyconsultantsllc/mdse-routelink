"use client"

import { useEffect, useState } from "react"
import { Bell, Package, Truck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  getOwnPharmacyNotificationSettings,
  updateOwnPharmacyNotificationSettings,
} from "@/app/actions/data-actions"

export function PharmacyNotificationSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    deliveryCompleted: true,
    deliveryEnRoute: true,
    deliveryDelayed: true,
    newDeliveryAssigned: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // These used to only ever live in localStorage and were never read back
  // on mount, so every time this dialog reopened it silently reset to the
  // hardcoded defaults above even though "Save Preferences" showed a
  // success toast. They're now backed by real columns on this user's own
  // pharmacy_users row (RLS already scopes reads/writes to their own row).
  useEffect(() => {
    let cancelled = false
    getOwnPharmacyNotificationSettings()
      .then((saved) => {
        if (!cancelled) setSettings(saved)
      })
      .catch((error) => {
        console.error("Failed to load notification settings:", error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateOwnPharmacyNotificationSettings(settings)
      toast({
        title: "Settings saved",
        description: "Your notification preferences have been updated.",
      })
    } catch (error) {
      toast({
        title: "Could not save settings",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>Choose how you want to be notified about deliveries</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Delivery Events */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Delivery Events</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="completed" className="cursor-pointer">
                    Delivery Completed
                  </Label>
                  <p className="text-xs text-muted-foreground">When a delivery to your pharmacy is completed</p>
                </div>
              </div>
              <Switch
                id="completed"
                checked={settings.deliveryCompleted}
                onCheckedChange={() => handleToggle("deliveryCompleted")}
                disabled={loading}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="enroute" className="cursor-pointer">
                    Delivery En Route
                  </Label>
                  <p className="text-xs text-muted-foreground">When a driver is on the way to your pharmacy</p>
                </div>
              </div>
              <Switch
                id="enroute"
                checked={settings.deliveryEnRoute}
                onCheckedChange={() => handleToggle("deliveryEnRoute")}
                disabled={loading}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="delayed" className="cursor-pointer">
                    Delivery Delayed
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When a delivery is running behind schedule (not yet sent - there's no delay detection built yet)
                  </p>
                </div>
              </div>
              <Switch
                id="delayed"
                checked={settings.deliveryDelayed}
                onCheckedChange={() => handleToggle("deliveryDelayed")}
                disabled={loading}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="assigned" className="cursor-pointer">
                    New Delivery Assigned
                  </Label>
                  <p className="text-xs text-muted-foreground">When a new delivery route includes your pharmacy</p>
                </div>
              </div>
              <Switch
                id="assigned"
                checked={settings.newDeliveryAssigned}
                onCheckedChange={() => handleToggle("newDeliveryAssigned")}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full" disabled={loading || saving}>
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  )
}

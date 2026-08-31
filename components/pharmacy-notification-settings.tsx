"use client"

import { useState } from "react"
import { Bell, Mail, MessageSquare, Package, Truck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export function PharmacyNotificationSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    deliveryCompleted: true,
    deliveryEnRoute: true,
    deliveryDelayed: true,
    newDeliveryAssigned: false,
  })

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSave = () => {
    // Save to localStorage or backend
    if (typeof window !== "undefined") {
      localStorage.setItem("pharmacyNotificationSettings", JSON.stringify(settings))
    }
    toast({
      title: "Settings saved",
      description: "Your notification preferences have been updated.",
    })
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
        {/* Notification Channels */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Notification Channels</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="email" className="cursor-pointer">
                  Email Notifications
                </Label>
              </div>
              <Switch
                id="email"
                checked={settings.emailNotifications}
                onCheckedChange={() => handleToggle("emailNotifications")}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="sms" className="cursor-pointer">
                  SMS Notifications
                </Label>
              </div>
              <Switch
                id="sms"
                checked={settings.smsNotifications}
                onCheckedChange={() => handleToggle("smsNotifications")}
              />
            </div>
          </div>
        </div>

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
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="delayed" className="cursor-pointer">
                    Delivery Delayed
                  </Label>
                  <p className="text-xs text-muted-foreground">When a delivery is running behind schedule</p>
                </div>
              </div>
              <Switch
                id="delayed"
                checked={settings.deliveryDelayed}
                onCheckedChange={() => handleToggle("deliveryDelayed")}
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
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full">
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  )
}

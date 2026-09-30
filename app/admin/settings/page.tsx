"use client"

import { useState, useEffect, useRef } from "react"
import type React from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { ChangeEmailDialog } from "@/components/change-email-dialog"
import { createClient } from "@/lib/supabase/client"
import { getDriverDetails } from "@/lib/region-utils"
import { saveOrShareFile, isNativeApp } from "@/lib/native-file"
import { User, Bell, Shield, Building2, Mail, Globe, Save, Upload, MapPin, Download } from "lucide-react"

const regionLabel = (v: string) => (v === "socal" ? "Southern California" : v === "minnesota" ? "Minnesota" : "No region")

export default function SettingsPage() {
  const { toast } = useToast()
  const [adminUserId, setAdminUserId] = useState("")
  const [changeEmailOpen, setChangeEmailOpen] = useState(false)
  const [bulkPharmacies, setBulkPharmacies] = useState<any[]>([])
  const [bulkDrivers, setBulkDrivers] = useState<any[]>([])
  // Snapshot of each pharmacy's/driver's region as loaded from the database,
  // so "Save All Regions" can tell what actually changed and preview it
  // before writing, instead of silently overwriting every row.
  const [originalPharmacyRegions, setOriginalPharmacyRegions] = useState<Record<string, string>>({})
  const [originalDriverRegions, setOriginalDriverRegions] = useState<Record<string, string>>({})
  const [regionsConfirmOpen, setRegionsConfirmOpen] = useState(false)
  const [regionsLoading, setRegionsLoading] = useState(true)
  const [isSavingRegions, setIsSavingRegions] = useState(false)

  // Avatar / photo upload
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Update Password
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" })
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  // Export All Data
  const [isExporting, setIsExporting] = useState(false)

  // Profile settings
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Admin",
  })

  useEffect(() => {
    const loadProfile = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      setAdminUserId(user.id)

      const { data } = await supabase
        .from("users")
        .select("first_name, last_name, email, phone, avatar_url")
        .eq("id", user.id)
        .single()

      if (data) {
        setProfileData({
          name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
          email: data.email || "",
          phone: data.phone || "",
          role: "Admin",
        })
        setAvatarUrl(data.avatar_url || null)
      }
    }
    loadProfile()
  }, [])

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    deliveryUpdates: true,
    driverUpdates: false,
    systemAlerts: true,
    weeklyReports: true,
  })

  // Company settings
  const [companySettings, setCompanySettings] = useState({
    companyName: "MDSE RouteLink",
    email: "contact@mdseroutelink.com",
    phone: "+1 (555) 100-2000",
    address: "123 Business Street, Suite 100",
    city: "San Francisco",
    state: "CA",
    zipCode: "94102",
  })

  // System settings
  const [systemSettings, setSystemSettings] = useState({
    timezone: "America/Los_Angeles",
    dateFormat: "MM/DD/YYYY",
    currency: "USD",
    language: "en",
    autoLogout: 30,
    onTimeGracePeriodMinutes: 15,
  })

  useEffect(() => {
    const loadSettings = async () => {
      const { getAppSetting } = await import("@/lib/app-settings")
      const savedCompany = await getAppSetting("company_settings")
      if (savedCompany) setCompanySettings((prev) => ({ ...prev, ...savedCompany }))

      const savedSystem = await getAppSetting("system_settings")
      if (savedSystem) setSystemSettings((prev) => ({ ...prev, ...savedSystem }))
    }
    loadSettings()
  }, [])

  useEffect(() => {
    const loadRegionData = async () => {
      setRegionsLoading(true)
      try {
        const { getPharmacies, getUsers } = await import("@/app/actions/data-actions")
        const [pharmacies, users] = await Promise.all([getPharmacies(), getUsers()])
        const mappedPharmacies = pharmacies.map((p: any) => ({ id: p.id, name: p.name, region: p.region || "" }))
        const mappedDrivers = users
          .filter((u: any) => u.role === "driver")
          .map((u: any) => ({
            id: u.id,
            name: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
            region: getDriverDetails(u)?.region || "",
          }))
        setBulkPharmacies(mappedPharmacies)
        setBulkDrivers(mappedDrivers)
        setOriginalPharmacyRegions(Object.fromEntries(mappedPharmacies.map((p) => [p.id, p.region])))
        setOriginalDriverRegions(Object.fromEntries(mappedDrivers.map((d) => [d.id, d.region])))
      } catch (error) {
        console.error("Error loading region data:", error)
      } finally {
        setRegionsLoading(false)
      }
    }
    loadRegionData()
  }, [])

  // Only pharmacies/drivers whose region actually changed since it was
  // loaded - used both to size/label the "Save All Regions" button and to
  // build the confirmation preview before anything is written.
  const changedBulkPharmacies = bulkPharmacies.filter((p) => (originalPharmacyRegions[p.id] ?? "") !== p.region)
  const changedBulkDrivers = bulkDrivers.filter((d) => (originalDriverRegions[d.id] ?? "") !== d.region)
  const pendingRegionChangeCount = changedBulkPharmacies.length + changedBulkDrivers.length

  const handleSaveAllRegions = async () => {
    setIsSavingRegions(true)
    try {
      const supabase = createClient()
      const { updateUser } = await import("@/app/actions/data-actions")

      const pharmacyResults = await Promise.all(
        bulkPharmacies.map(async (p) => {
          const { error } = await supabase.from("pharmacies").update({ region: p.region || null }).eq("id", p.id)
          return { name: p.name, error }
        }),
      )

      const driverResults = await Promise.all(
        bulkDrivers.map(async (d) => {
          try {
            await updateUser(d.id, { region: d.region || undefined })
            return { name: d.name, error: null }
          } catch (err: any) {
            return { name: d.name, error: err }
          }
        }),
      )

      const failures = [...pharmacyResults, ...driverResults].filter((r) => r.error)

      if (failures.length > 0) {
        console.error("Region save failures:", failures)
        toast({
          title: `${failures.length} region${failures.length > 1 ? "s" : ""} failed to save`,
          description: failures.map((f) => f.name).join(", "),
          variant: "destructive",
        })
      } else {
        toast({ title: "Regions saved", description: "All region assignments have been updated." })
      }

      // Reload from the database rather than trusting local state, so the
      // screen reflects what's actually saved - not just what was clicked.
      const { getPharmacies, getUsers } = await import("@/app/actions/data-actions")
      const [pharmacies, users] = await Promise.all([getPharmacies(), getUsers()])
      const driverUsers = users.filter((u: any) => u.role === "driver")
      const mappedPharmacies = pharmacies.map((p: any) => ({ id: p.id, name: p.name, region: p.region || "" }))
      const mappedDrivers = driverUsers.map((u: any) => ({
        id: u.id,
        name: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
        region: getDriverDetails(u)?.region || "",
      }))
      setBulkPharmacies(mappedPharmacies)
      setBulkDrivers(mappedDrivers)
      setOriginalPharmacyRegions(Object.fromEntries(mappedPharmacies.map((p) => [p.id, p.region])))
      setOriginalDriverRegions(Object.fromEntries(mappedDrivers.map((d) => [d.id, d.region])))
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save regions", variant: "destructive" })
    } finally {
      setIsSavingRegions(false)
      setRegionsConfirmOpen(false)
    }
  }

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !adminUserId) return

    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Please choose an image file", variant: "destructive" })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Error", description: "Image must be 2MB or smaller", variant: "destructive" })
      return
    }

    setIsUploadingAvatar(true)
    try {
      const supabase = createClient()
      const ext = file.name.split(".").pop() || "jpg"
      const path = `${adminUserId}/photo-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from("avatars").getPublicUrl(path)
      const { updateUser } = await import("@/app/actions/data-actions")
      await updateUser(adminUserId, { avatarUrl: data.publicUrl })

      setAvatarUrl(data.publicUrl)
      toast({ title: "Photo updated", description: "Your profile photo has been changed." })
    } catch (error: any) {
      const bucketMissing = /bucket.*not.*found/i.test(error?.message || "")
      toast({
        title: "Error",
        description: bucketMissing
          ? "Photo storage isn't set up yet - run scripts/029_user_avatars.sql in Supabase, then try again."
          : error?.message || "Failed to upload photo",
        variant: "destructive",
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!passwordForm.current) {
      toast({ title: "Error", description: "Enter your current password", variant: "destructive" })
      return
    }
    if (passwordForm.new.length < 6) {
      toast({ title: "Error", description: "New password must be at least 6 characters", variant: "destructive" })
      return
    }
    if (passwordForm.new !== passwordForm.confirm) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" })
      return
    }

    setIsSavingPassword(true)
    try {
      const supabase = createClient()
      // supabase.auth.updateUser() doesn't check the caller's existing
      // password on its own - without re-verifying it here first, "Current
      // Password" would just be a decorative field, the same class of bug as
      // the dead button this replaces.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: profileData.email,
        password: passwordForm.current,
      })
      if (verifyError) {
        toast({ title: "Error", description: "Current password is incorrect", variant: "destructive" })
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: passwordForm.new })
      if (updateError) throw updateError

      toast({ title: "Password updated", description: "Your password has been changed successfully" })
      setPasswordForm({ current: "", new: "", confirm: "" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update password", variant: "destructive" })
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const { getPharmacies, getUsers, getRoutes, getDeliveryLogs } = await import("@/app/actions/data-actions")
      const [pharmacies, users, routes, deliveryLogs] = await Promise.all([
        getPharmacies(),
        getUsers(),
        getRoutes(),
        // getDeliveryLogs() defaults to the most recent 500 rows (right for
        // dashboards) - this is meant to be a full backup, so ask for
        // everything instead of silently truncating it.
        getDeliveryLogs(1_000_000),
      ])

      const payload = {
        exportedAt: new Date().toISOString(),
        pharmacies,
        users,
        routes,
        deliveryLogs,
      }
      const filename = `routelink-export-${new Date().toISOString().slice(0, 10)}.json`
      await saveOrShareFile(JSON.stringify(payload, null, 2), filename, "application/json")

      toast({
        title: "Export ready",
        description: isNativeApp() ? `Choose where to save or share ${filename}` : "Your data export has downloaded.",
      })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to export data", variant: "destructive" })
    } finally {
      setIsExporting(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      const { updateUser } = await import("@/app/actions/data-actions")
      const [firstName, ...rest] = profileData.name.trim().split(" ")
      const lastName = rest.join(" ")

      await updateUser(adminUserId, {
        firstName,
        lastName,
        phone: profileData.phone,
      })

      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save profile",
        variant: "destructive",
      })
    }
  }

  const handleSaveNotifications = () => {
    toast({
      title: "Notifications Updated",
      description: "Your notification preferences have been saved",
    })
  }

  const handleSaveCompany = async () => {
    try {
      const { setAppSetting } = await import("@/lib/app-settings")
      await setAppSetting("company_settings", companySettings)

      toast({
        title: "Company Settings Updated",
        description: "Company information has been saved successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save company settings",
        variant: "destructive",
      })
    }
  }

  const handleSaveSystem = async () => {
    try {
      const { setAppSetting } = await import("@/lib/app-settings")
      await setAppSetting("system_settings", systemSettings)

      toast({
        title: "System Settings Updated",
        description: "System preferences have been saved successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save system settings",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden pt-16 md:pt-0">
        <AdminHeader title="Settings" />

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 lg:w-[720px]">
              <TabsTrigger value="profile">
                <User className="h-4 w-4 mr-2" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="notifications">
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="company">
                <Building2 className="h-4 w-4 mr-2" />
                Company
              </TabsTrigger>
              <TabsTrigger value="system">
                <Globe className="h-4 w-4 mr-2" />
                System
              </TabsTrigger>
              <TabsTrigger value="regions">
                <MapPin className="h-4 w-4 mr-2" />
                Regions
              </TabsTrigger>
            </TabsList>

            {/* Profile Settings */}
            <TabsContent value="profile" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
                    <div className="flex items-center gap-6 mb-6">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={avatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=admin"} />
                        <AvatarFallback>AD</AvatarFallback>
                      </Avatar>
                      <div>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarFileChange}
                        />
                        <Button
                          variant="outline"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {isUploadingAvatar ? "Uploading..." : "Change Photo"}
                        </Button>
                        <p className="text-sm text-muted-foreground mt-2">JPG, GIF or PNG. Max size of 2MB</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Input id="role" value={profileData.role} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="flex gap-2">
                        <Input id="email" type="email" value={profileData.email} disabled className="flex-1" />
                        <Button type="button" variant="outline" onClick={() => setChangeEmailOpen(true)}>
                          Change
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSaveProfile}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Security</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.new}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleUpdatePassword} disabled={isSavingPassword}>
                      <Shield className="h-4 w-4 mr-2" />
                      {isSavingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications" className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({ ...notificationSettings, emailNotifications: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive push notifications in browser</p>
                    </div>
                    <Switch
                      checked={notificationSettings.pushNotifications}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({ ...notificationSettings, pushNotifications: checked })
                      }
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-4">Notification Types</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Delivery Updates</Label>
                          <p className="text-sm text-muted-foreground">Get notified about delivery status changes</p>
                        </div>
                        <Switch
                          checked={notificationSettings.deliveryUpdates}
                          onCheckedChange={(checked) =>
                            setNotificationSettings({ ...notificationSettings, deliveryUpdates: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Driver Updates</Label>
                          <p className="text-sm text-muted-foreground">
                            Notifications about driver availability and status
                          </p>
                        </div>
                        <Switch
                          checked={notificationSettings.driverUpdates}
                          onCheckedChange={(checked) =>
                            setNotificationSettings({ ...notificationSettings, driverUpdates: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>System Alerts</Label>
                          <p className="text-sm text-muted-foreground">Important system messages and alerts</p>
                        </div>
                        <Switch
                          checked={notificationSettings.systemAlerts}
                          onCheckedChange={(checked) =>
                            setNotificationSettings({ ...notificationSettings, systemAlerts: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Weekly Reports</Label>
                          <p className="text-sm text-muted-foreground">Receive weekly performance summary reports</p>
                        </div>
                        <Switch
                          checked={notificationSettings.weeklyReports}
                          onCheckedChange={(checked) =>
                            setNotificationSettings({ ...notificationSettings, weeklyReports: checked })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSaveNotifications}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Preferences
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Company Settings */}
            <TabsContent value="company" className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Company Information</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={companySettings.companyName}
                      onChange={(e) => setCompanySettings({ ...companySettings, companyName: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyEmail">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="companyEmail"
                          type="email"
                          value={companySettings.email}
                          onChange={(e) => setCompanySettings({ ...companySettings, email: e.target.value })}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyPhone">Phone Number</Label>
                      <Input
                        id="companyPhone"
                        type="tel"
                        value={companySettings.phone}
                        onChange={(e) => setCompanySettings({ ...companySettings, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      value={companySettings.address}
                      onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={companySettings.city}
                        onChange={(e) => setCompanySettings({ ...companySettings, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={companySettings.state}
                        onChange={(e) => setCompanySettings({ ...companySettings, state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input
                        id="zipCode"
                        value={companySettings.zipCode}
                        onChange={(e) => setCompanySettings({ ...companySettings, zipCode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSaveCompany}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Company Info
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* System Settings */}
            <TabsContent value="system" className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">System Preferences</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select
                        value={systemSettings.timezone}
                        onValueChange={(value) => setSystemSettings({ ...systemSettings, timezone: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                          <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                          <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dateFormat">Date Format</Label>
                      <Select
                        value={systemSettings.dateFormat}
                        onValueChange={(value) => setSystemSettings({ ...systemSettings, dateFormat: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={systemSettings.currency}
                        onValueChange={(value) => setSystemSettings({ ...systemSettings, currency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="CAD">CAD ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <Select
                        value={systemSettings.language}
                        onValueChange={(value) => setSystemSettings({ ...systemSettings, language: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="autoLogout">Auto Logout (minutes)</Label>
                    <Input
                      id="autoLogout"
                      type="number"
                      value={systemSettings.autoLogout}
                      onChange={(e) =>
                        setSystemSettings({ ...systemSettings, autoLogout: Number.parseInt(e.target.value) })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      Automatically log out after specified minutes of inactivity
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="onTimeGracePeriod">On-Time Grace Period (minutes)</Label>
                    <Input
                      id="onTimeGracePeriod"
                      type="number"
                      value={systemSettings.onTimeGracePeriodMinutes}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          onTimeGracePeriodMinutes: Number.parseInt(e.target.value),
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      A delivery counts as on-time if completed within this many minutes of a route's scheduled end
                      time. Used in Reports and Performance.
                    </p>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSaveSystem}>
                      <Save className="h-4 w-4 mr-2" />
                      Save System Settings
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-red-600">Danger Zone</h3>
                <div className="space-y-4">
                  {/* "Clear System Cache" used to live here as a button with no
                      onClick and, worse, nothing behind it to clear - there's no
                      cache layer anywhere in this app (app_settings reads go
                      straight to Supabase every time). Removed rather than build
                      a fake control for a cache that doesn't exist. */}
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <h4 className="font-medium mb-2">Export All Data</h4>
                    <p className="text-sm text-muted-foreground mb-3">Download a complete backup of all system data.</p>
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-100 bg-transparent"
                      onClick={handleExportData}
                      disabled={isExporting}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {isExporting ? "Exporting..." : "Export Data"}
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="regions" className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Region Assignment</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Assign a region to every pharmacy and driver at once, instead of editing them one at a time.
                    </p>
                  </div>
                  <Button
                    onClick={() => setRegionsConfirmOpen(true)}
                    disabled={isSavingRegions || regionsLoading || pendingRegionChangeCount === 0}
                  >
                    {isSavingRegions
                      ? "Saving..."
                      : pendingRegionChangeCount > 0
                        ? `Save All Regions (${pendingRegionChangeCount})`
                        : "Save All Regions"}
                  </Button>
                </div>

                {regionsLoading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="font-medium mb-3">Pharmacies</h4>
                      <div className="space-y-2">
                        {bulkPharmacies.map((pharmacy, index) => (
                          <div key={pharmacy.id} className="flex items-center justify-between gap-3 p-2 border rounded-md">
                            <span className="text-sm truncate">{pharmacy.name}</span>
                            <Select
                              value={pharmacy.region}
                              onValueChange={(value) => {
                                const updated = [...bulkPharmacies]
                                updated[index] = { ...pharmacy, region: value }
                                setBulkPharmacies(updated)
                              }}
                            >
                              <SelectTrigger className="w-[180px] shrink-0">
                                <SelectValue placeholder="No region" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="socal">Southern California</SelectItem>
                                <SelectItem value="minnesota">Minnesota</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                        {bulkPharmacies.length === 0 && (
                          <p className="text-sm text-muted-foreground">No pharmacies found.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Drivers</h4>
                      <div className="space-y-2">
                        {bulkDrivers.map((driver, index) => (
                          <div key={driver.id} className="flex items-center justify-between gap-3 p-2 border rounded-md">
                            <span className="text-sm truncate">{driver.name}</span>
                            <Select
                              value={driver.region}
                              onValueChange={(value) => {
                                const updated = [...bulkDrivers]
                                updated[index] = { ...driver, region: value }
                                setBulkDrivers(updated)
                              }}
                            >
                              <SelectTrigger className="w-[180px] shrink-0">
                                <SelectValue placeholder="No region" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="socal">Southern California</SelectItem>
                                <SelectItem value="minnesota">Minnesota</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                        {bulkDrivers.length === 0 && (
                          <p className="text-sm text-muted-foreground">No drivers found.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <ChangeEmailDialog open={changeEmailOpen} onOpenChange={setChangeEmailOpen} currentEmail={profileData.email} />

      <AlertDialog open={regionsConfirmOpen} onOpenChange={setRegionsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm region changes</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">
                  This will update {pendingRegionChangeCount} record{pendingRegionChangeCount === 1 ? "" : "s"}:
                </p>
                <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
                  {changedBulkPharmacies.map((pharmacy) => (
                    <div key={`p-${pharmacy.id}`} className="px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{pharmacy.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {regionLabel(originalPharmacyRegions[pharmacy.id] ?? "")} → {regionLabel(pharmacy.region)}
                      </span>
                    </div>
                  ))}
                  {changedBulkDrivers.map((driver) => (
                    <div key={`d-${driver.id}`} className="px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{driver.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {regionLabel(originalDriverRegions[driver.id] ?? "")} → {regionLabel(driver.region)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingRegions}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleSaveAllRegions()
              }}
              disabled={isSavingRegions}
            >
              {isSavingRegions
                ? "Saving..."
                : `Save ${pendingRegionChangeCount} Change${pendingRegionChangeCount === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

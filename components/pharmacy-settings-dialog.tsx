"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Mail } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { ChangeEmailDialog } from "@/components/change-email-dialog"
import { PharmacyNotificationSettings } from "@/components/pharmacy-notification-settings"
import { PharmacyDeliverySettings } from "@/components/pharmacy-delivery-settings"

interface PharmacySettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userEmail: string
}

export function PharmacySettingsDialog({ open, onOpenChange, userId, userEmail }: PharmacySettingsDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [changeEmailOpen, setChangeEmailOpen] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    if (!open) return
    const loadProfile = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from("users")
        .select("first_name, last_name, phone")
        .eq("id", userId)
        .single()

      if (data) {
        setFirstName(data.first_name || "")
        setLastName(data.last_name || "")
        setPhone(data.phone || "")
      }
      setLoading(false)
    }
    loadProfile()
  }, [open, userId])

  const handleSaveProfile = async () => {
    setIsSavingProfile(true)
    try {
      const { updateOwnProfile } = await import("@/app/actions/data-actions")
      await updateOwnProfile({ firstName, lastName, phone })
      toast({ title: "Saved", description: "Your profile has been updated." })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" })
      return
    }

    setIsSavingPassword(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      toast({ title: "Password updated", description: "Use your new password next time you sign in." })
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : (
            <Tabs defaultValue="profile">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
                <TabsTrigger value="delivery">Delivery</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First Name</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full">
                  {isSavingProfile ? "Saving..." : "Save Profile"}
                </Button>
              </TabsContent>

              <TabsContent value="notifications" className="pt-4">
                <PharmacyNotificationSettings />
              </TabsContent>

              <TabsContent value="delivery" className="pt-4">
                <PharmacyDeliverySettings open={open} />
              </TabsContent>

              <TabsContent value="account" className="space-y-6 pt-4">
                <div>
                  <Label>Email</Label>
                  <div className="flex gap-2">
                    <Input value={userEmail} disabled className="flex-1" />
                    <Button type="button" variant="outline" onClick={() => setChangeEmailOpen(true)}>
                      <Mail className="h-4 w-4 mr-2" />
                      Change
                    </Button>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-3">
                  <Label className="text-sm font-semibold">Change Password</Label>
                  <div>
                    <Input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full bg-transparent"
                    disabled={isSavingPassword || !newPassword}
                  >
                    {isSavingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <ChangeEmailDialog open={changeEmailOpen} onOpenChange={setChangeEmailOpen} currentEmail={userEmail} />
    </>
  )
}

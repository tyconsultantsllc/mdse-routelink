"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
  onSuccess: () => void
}

export function EditUserModal({ isOpen, onClose, user, onSuccess }: EditUserModalProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    vehicleType: "",
    vehiclePlate: "",
    licenseNumber: "",
    region: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        email: user.email || "",
        phone: user.phone || "",
        vehicleType: user.drivers?.[0]?.vehicle_type || "",
        vehiclePlate: user.drivers?.[0]?.vehicle_plate || "",
        licenseNumber: user.drivers?.[0]?.license_number || "",
        region: user.drivers?.[0]?.region || "",
      })
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { updateUser, adminUpdateUserEmail } = await import("@/app/actions/data-actions")

      if (formData.email && formData.email !== user.email) {
        await adminUpdateUserEmail(user.id, formData.email)
      }

      await updateUser(user.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        vehicleType: formData.vehicleType,
        vehiclePlate: formData.vehiclePlate,
        licenseNumber: formData.licenseNumber,
        region: formData.region,
      })

      toast({
        title: "Success",
        description: "User updated successfully",
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Changing this immediately updates their login email - no confirmation needed from them.
            </p>
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          {user.role === "driver" && (
            <>
              <div>
                <Label htmlFor="editRegion">Region *</Label>
                <Select value={formData.region} onValueChange={(value) => setFormData({ ...formData, region: value })}>
                  <SelectTrigger id="editRegion">
                    <SelectValue placeholder="Select a region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="socal">Southern California</SelectItem>
                    <SelectItem value="minnesota">Minnesota</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="vehicleType">Vehicle Type</Label>
                <Input
                  id="vehicleType"
                  value={formData.vehicleType}
                  onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="vehiclePlate">Vehicle Plate</Label>
                <Input
                  id="vehiclePlate"
                  value={formData.vehiclePlate}
                  onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="licenseNumber">License Number</Label>
                <Input
                  id="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Building2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface EditPharmacyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pharmacy: any
  onSuccess?: () => void
}

export function EditPharmacyModal({ open, onOpenChange, pharmacy, onSuccess }: EditPharmacyModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    latitude: "",
    longitude: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (pharmacy) {
      setFormData({
        name: pharmacy.name || "",
        address: pharmacy.address || "",
        contactEmail: pharmacy.email || "",
        contactPhone: pharmacy.phone || "",
        latitude: pharmacy.latitude != null ? String(pharmacy.latitude) : "",
        longitude: pharmacy.longitude != null ? String(pharmacy.longitude) : "",
      })
    }
  }, [pharmacy])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from("pharmacies")
        .update({
          name: formData.name,
          address: formData.address,
          phone: formData.contactPhone,
          email: formData.contactEmail,
          latitude: formData.latitude ? Number.parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? Number.parseFloat(formData.longitude) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pharmacy.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Pharmacy updated successfully",
      })

      onSuccess?.()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update pharmacy",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!pharmacy) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Edit Pharmacy</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="editPharmacyName">Pharmacy Name *</Label>
            <Input
              id="editPharmacyName"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="editAddress">Address *</Label>
            <Input
              id="editAddress"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="editLatitude">Latitude</Label>
              <Input
                id="editLatitude"
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="editLongitude">Longitude</Label>
              <Input
                id="editLongitude"
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="editContactEmail">Contact Email</Label>
            <Input
              id="editContactEmail"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="editContactPhone">Contact Phone</Label>
            <Input
              id="editContactPhone"
              type="tel"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

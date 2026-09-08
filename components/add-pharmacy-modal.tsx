"use client"

import { useState } from "react"
import { Building2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { geocodeAddress } from "@/lib/geocode"

interface AddPharmacyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddPharmacyModal({ open, onOpenChange, onSuccess }: AddPharmacyModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    latitude: "",
    longitude: "",
    region: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()

      let latitude = formData.latitude ? parseFloat(formData.latitude) : null
      let longitude = formData.longitude ? parseFloat(formData.longitude) : null

      // Every other address in the app (route stops, dropoffs) is geocoded
      // automatically. Requiring an admin to manually look up and type in
      // exact coordinates here was inconsistent and easy to skip entirely -
      // and a pharmacy with no coordinates silently breaks the maps and
      // route optimizer wherever it's used.
      if (latitude == null || longitude == null) {
        const geocoded = await geocodeAddress(formData.address)
        if (geocoded) {
          latitude = geocoded.lat
          longitude = geocoded.lng
        }
      }

      const { error } = await supabase.from("pharmacies").insert([
        {
          name: formData.name,
          address: formData.address,
          phone: formData.contactPhone,
          email: formData.contactEmail,
          latitude,
          longitude,
          region: formData.region || null,
        },
      ])

      if (error) {
        throw error
      }

      toast({
        title: "Success",
        description: "Pharmacy added successfully",
      })

      onSuccess?.()
      onOpenChange(false)
      resetForm()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add pharmacy",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      contactEmail: "",
      contactPhone: "",
      latitude: "",
      longitude: "",
      region: "",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Add New Pharmacy</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="pharmacyName">Pharmacy Name *</Label>
            <Input
              id="pharmacyName"
              placeholder="Enter pharmacy name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              placeholder="Full street address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="region">Region *</Label>
            <Select value={formData.region} onValueChange={(value) => setFormData({ ...formData, region: value })}>
              <SelectTrigger id="region">
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="socal">Southern California</SelectItem>
                <SelectItem value="minnesota">Minnesota</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="latitude">Latitude (optional)</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="Auto-detected from address"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude (optional)</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="Auto-detected from address"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder="email@example.com"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input
              id="contactPhone"
              type="tel"
              placeholder="(555) 123-4567"
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
              {isLoading ? "Saving..." : "Save Pharmacy"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

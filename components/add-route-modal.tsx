"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { MapIcon, Plus, X, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { RouteOptimizerDialog } from "@/components/route-optimizer-dialog"
import { AddressAutocompleteInput } from "@/components/address-autocomplete-input"
import { geocodeAddress } from "@/lib/geocode"

interface AddRouteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface RouteStopForm {
  pharmacyId: string
  pharmacyName: string
  pickupAddress: string
  dropoffAddress: string
}

export function AddRouteModal({ open, onOpenChange, onSuccess }: AddRouteModalProps) {
  const { toast } = useToast()
  const [routeName, setRouteName] = useState("")
  const [startTime, setStartTime] = useState("")
  const [priority, setPriority] = useState<string>("medium")
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false)
  const [preparedStops, setPreparedStops] = useState<any[]>([])
  const [isPreparingOptimizer, setIsPreparingOptimizer] = useState(false)
  const [stops, setStops] = useState<RouteStopForm[]>([
    {
      pharmacyId: "",
      pharmacyName: "",
      pickupAddress: "",
      dropoffAddress: "",
    },
  ])
  const [pharmacies, setPharmacies] = useState<Array<{ id: string; name: string; address: string; latitude?: number; longitude?: number }>>([])
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      loadPharmacies()
    }
  }, [open])

  const loadPharmacies = async () => {
    setIsLoadingPharmacies(true)
    try {
      const { getPharmacies } = await import('@/app/actions/data-actions')
      const data = await getPharmacies()
      setPharmacies(data.map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
      })))
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load pharmacies",
        variant: "destructive",
      })
    } finally {
      setIsLoadingPharmacies(false)
    }
  }

  const addStop = () => {
    setStops([
      ...stops,
      {
        pharmacyId: "",
        pharmacyName: "",
        pickupAddress: "",
        dropoffAddress: "",
      },
    ])
  }

  const removeStop = (index: number) => {
    setStops(stops.filter((_, i) => i !== index))
  }

  const updateStop = (index: number, field: keyof RouteStopForm, value: string) => {
    const newStops = [...stops]
    newStops[index][field] = value
    setStops(newStops)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!routeName || stops.some((s) => !s.pharmacyId || !s.dropoffAddress)) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const { createRoute } = await import('@/app/actions/data-actions')
      await createRoute({
        name: routeName,
        startTime: startTime || undefined,
        priority,
        stops: stops.map((stop, index) => ({
          pharmacyId: stop.pharmacyId,
          pickupAddress: stop.pickupAddress,
          dropoffAddress: stop.dropoffAddress,
          sequence: index + 1,
        })),
      })

      toast({
        title: "Route Created",
        description: `${routeName} has been created successfully`,
      })
      
      // Reset form
      setRouteName("")
      setStartTime("")
      setPriority("medium")
      setStops([{
        pharmacyId: "",
        pharmacyName: "",
        pickupAddress: "",
        dropoffAddress: "",
      }])
      
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create route",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "urgent":
        return "bg-red-100 text-red-800"
      case "high":
        return "bg-orange-100 text-orange-800"
      case "medium":
        return "bg-blue-100 text-blue-800"
      case "low":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const prepareStopsForOptimization = async () => {
    const validStops = stops.filter((s) => s.pharmacyId && s.dropoffAddress)

    return Promise.all(
      validStops.map(async (stop, index) => {
        const coords = await getPharmacyCoordinates(stop.pharmacyId)
        return {
          id: `stop-${index}`,
          pharmacy_id: stop.pharmacyId,
          name: stop.pharmacyName,
          latitude: coords.lat,
          longitude: coords.lng,
          priority: priority as "urgent" | "high" | "medium" | "low",
          pickupAddress: stop.pickupAddress,
          dropoffAddress: stop.dropoffAddress,
        }
      }),
    )
  }

  const getPharmacyCoordinates = async (pharmacyId: string): Promise<{ lat: number; lng: number }> => {
    const pharmacy = pharmacies.find((p) => p.id === pharmacyId)

    // Prefer the pharmacy's real stored coordinates (populated for seeded
    // pharmacies; may be missing for ones added later without geocoding).
    if (pharmacy?.latitude != null && pharmacy?.longitude != null) {
      return { lat: pharmacy.latitude, lng: pharmacy.longitude }
    }

    // Fall back to geocoding the pharmacy's address live rather than
    // silently returning a fixed point that isn't actually where it is.
    if (pharmacy?.address) {
      const geocoded = await geocodeAddress(pharmacy.address)
      if (geocoded) return geocoded
    }

    // Last resort if geocoding fails entirely (e.g. malformed address) —
    // an approximate Orange County center point, better than crashing.
    return { lat: 33.7175, lng: -117.8311 }
  }

  const handleOptimizedStops = (optimizedStops: any[]) => {
    console.log('[v0] Original stops:', stops)
    console.log('[v0] Optimized stops:', optimizedStops)
    
    const reorderedStops = optimizedStops.map((opt) => {
      // Find the original stop by pharmacy ID
      const originalStop = stops.find((s) => s.pharmacyId === opt.pharmacy_id)
      
      if (originalStop) {
        // Return the complete original stop with all its data intact
        return {
          pharmacyId: originalStop.pharmacyId,
          pharmacyName: originalStop.pharmacyName,
          pickupAddress: originalStop.pickupAddress,
          dropoffAddress: originalStop.dropoffAddress,
        }
      }
      
      // Fallback (should not happen in normal operation)
      return {
        pharmacyId: "",
        pharmacyName: "",
        pickupAddress: "",
        dropoffAddress: "",
      }
    })
    
    console.log('[v0] Reordered stops:', reorderedStops)
    setStops(reorderedStops)
    
    toast({
      title: "Route Optimized",
      description: `Stops reordered for optimal efficiency`,
    })
  }

  const handleOptimizeClick = async () => {
    if (stops.filter((s) => s.pharmacyId && s.dropoffAddress).length < 2) {
      toast({
        title: "Not Enough Stops",
        description: "Add at least 2 stops to optimize the route",
        variant: "destructive",
      })
      return
    }

    setIsPreparingOptimizer(true)
    try {
      const prepared = await prepareStopsForOptimization()
      setPreparedStops(prepared)
      setIsOptimizerOpen(true)
    } catch {
      toast({
        title: "Error",
        description: "Could not look up pharmacy locations",
        variant: "destructive",
      })
    } finally {
      setIsPreparingOptimizer(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
            <MapIcon className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Create New Route</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="routeName">Route Name *</Label>
              <Input
                id="routeName"
                placeholder="e.g., Downtown Circuit"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority *</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <Badge className={getPriorityColor("low")}>Low</Badge>
                  </SelectItem>
                  <SelectItem value="medium">
                    <Badge className={getPriorityColor("medium")}>Medium</Badge>
                  </SelectItem>
                  <SelectItem value="high">
                    <Badge className={getPriorityColor("high")}>High</Badge>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <Badge className={getPriorityColor("urgent")}>Urgent</Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Route Stops *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOptimizeClick}
                  disabled={isPreparingOptimizer || stops.filter((s) => s.pharmacyId && s.dropoffAddress).length < 2}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isPreparingOptimizer ? "Looking up locations..." : "Optimize"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addStop}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stop
                </Button>
              </div>
            </div>

            {stops.map((stop, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3 relative">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">Stop {index + 1}</Badge>
                  {stops.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStop(index)}
                      className="h-6 w-6"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`pharmacy-${index}`}>Pharmacy *</Label>
                    <Select
                      value={stop.pharmacyId}
                      onValueChange={(value) => {
                        updateStop(index, "pharmacyId", value)
                        const pharmacy = pharmacies.find(p => p.id === value)
                        if (pharmacy) {
                          updateStop(index, "pharmacyName", pharmacy.name)
                          updateStop(index, "pickupAddress", pharmacy.address)
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingPharmacies ? "Loading..." : "Select pharmacy"} />
                      </SelectTrigger>
                      <SelectContent>
                        {pharmacies.map(pharmacy => (
                          <SelectItem key={pharmacy.id} value={pharmacy.id}>
                            {pharmacy.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`pickup-${index}`}>Pickup Address</Label>
                    <Input
                      id={`pickup-${index}`}
                      placeholder="Pharmacy address"
                      value={stop.pickupAddress}
                      onChange={(e) => updateStop(index, "pickupAddress", e.target.value)}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`dropoff-${index}`}>Dropoff Address *</Label>
                  <AddressAutocompleteInput
                    id={`dropoff-${index}`}
                    placeholder="Start typing to search address..."
                    value={stop.dropoffAddress}
                    onChange={(value) => updateStop(index, "dropoffAddress", value)}
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Route"}
            </Button>
          </div>
        </form>
      </DialogContent>
      <RouteOptimizerDialog
        isOpen={isOptimizerOpen}
        onClose={() => setIsOptimizerOpen(false)}
        stops={preparedStops}
        onOptimize={handleOptimizedStops}
      />
    </Dialog>
  )
}

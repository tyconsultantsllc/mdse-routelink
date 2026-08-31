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
import { AddressAutocompleteInput } from "@/components/address-autocomplete-input"

interface EditRouteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routeId: number | null
  onSuccess?: () => void
}

interface RouteStopForm {
  id?: string
  pharmacyId: string
  pharmacyName: string
  pickupAddress: string
  dropoffAddress: string
  stopOrder: number
}

export function EditRouteModal({ open, onOpenChange, routeId, onSuccess }: EditRouteModalProps) {
  const { toast } = useToast()
  const [routeName, setRouteName] = useState("")
  const [startTime, setStartTime] = useState("")
  const [priority, setPriority] = useState<string>("medium")
  const [status, setStatus] = useState<string>("pending")
  const [stops, setStops] = useState<RouteStopForm[]>([])
  const [pharmacies, setPharmacies] = useState<Array<{ id: string; name: string; address: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open && routeId) {
      loadRouteData()
      loadPharmacies()
    }
  }, [open, routeId])

  const loadRouteData = async () => {
    if (!routeId) return
    
    setIsLoading(true)
    try {
      const { getRouteById } = await import('@/app/actions/data-actions')
      const routeData = await getRouteById(routeId)
      
      if (routeData) {
        setRouteName(routeData.name || "")
        setPriority(routeData.priority || "medium")
        setStatus(routeData.status || "pending")
        
        if (routeData.scheduled_start) {
          const date = new Date(routeData.scheduled_start)
          const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
          setStartTime(timeStr)
        }
        
        if (routeData.stops && routeData.stops.length > 0) {
          setStops(routeData.stops.map((stop: any) => ({
            id: stop.id,
            pharmacyId: stop.pharmacy_id,
            pharmacyName: stop.pharmacy_name || "",
            pickupAddress: stop.pickup_address || "",
            dropoffAddress: stop.dropoff_address || "",
            stopOrder: stop.stop_order || 0,
          })))
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load route data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadPharmacies = async () => {
    try {
      const { getPharmacies } = await import('@/app/actions/data-actions')
      const data = await getPharmacies()
      setPharmacies(data.map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
      })))
    } catch (error) {
      console.error("Failed to load pharmacies:", error)
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
        stopOrder: stops.length + 1,
      },
    ])
  }

  const removeStop = (index: number) => {
    setStops(stops.filter((_, i) => i !== index))
  }

  const updateStop = (index: number, field: keyof RouteStopForm, value: string) => {
    const newStops = [...stops]
    newStops[index][field] = value as any
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
      const { updateRoute } = await import('@/app/actions/data-actions')
      await updateRoute(routeId!, {
        name: routeName,
        startTime: startTime || undefined,
        priority,
        status,
        stops: stops.map((stop, index) => ({
          id: stop.id,
          pharmacyId: stop.pharmacyId,
          pickupAddress: stop.pickupAddress,
          dropoffAddress: stop.dropoffAddress,
          stopOrder: index + 1,
        })),
      })

      toast({
        title: "Route Updated",
        description: `${routeName} has been updated successfully`,
      })
      
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update route",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
            <MapIcon className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Edit Route</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading route data...</p>
          </div>
        ) : (
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
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Route Stops *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStop}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stop
                </Button>
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
                          <SelectValue placeholder="Select pharmacy" />
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
                {isSubmitting ? "Updating..." : "Update Route"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

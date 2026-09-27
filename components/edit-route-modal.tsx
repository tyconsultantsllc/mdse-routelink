"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { MapIcon, Plus, X, Sparkles, Star, History, Link2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { parseBingMapsLink, parseGoogleMapsLink, parseManualAddressList } from "@/lib/route-link-parser"
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
import { AddressAutocompleteInput } from "@/components/address-autocomplete-input"
import { TimeSelect } from "@/components/time-select"

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
  status?: string
  isPriority?: boolean
  designatedTime?: string
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
  const [seriesId, setSeriesId] = useState<string | null>(null)
  const [showScopePrompt, setShowScopePrompt] = useState(false)
  const [lastDriverByStop, setLastDriverByStop] = useState<Record<number, { driverName: string; deliveredAt: string | null } | null>>({})
  const [showLinkPaste, setShowLinkPaste] = useState(false)
  const [linkPastePharmacyId, setLinkPastePharmacyId] = useState("")
  const [linkPasteText, setLinkPasteText] = useState("")

  useEffect(() => {
    if (open && routeId) {
      loadRouteData()
      loadPharmacies()
    }
  }, [open, routeId])

  // Looks up, per stop, who last actually delivered to that same
  // pharmacy+address pair - debounced so it doesn't fire a query on every
  // keystroke while an address is still being typed/autocompleted. This
  // route's own delivery on this same stop is excluded, since editing a
  // route shouldn't show itself as "the last driver."
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(async () => {
      const { getLastDriverForStop } = await import('@/app/actions/data-actions')
      const results = await Promise.all(
        stops.map(async (stop, index) => {
          if (!stop.pharmacyId || !stop.dropoffAddress?.trim()) return [index, null] as const
          try {
            const info = await getLastDriverForStop(stop.pharmacyId, stop.dropoffAddress, routeId ?? undefined)
            return [index, info] as const
          } catch {
            return [index, null] as const
          }
        }),
      )
      setLastDriverByStop(Object.fromEntries(results))
    }, 700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routeId, stops.map((s) => `${s.pharmacyId}|${s.dropoffAddress}`).join('||')])

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
        setSeriesId(routeData.series_id || null)
        
        if (routeData.start_time) {
          const date = new Date(routeData.start_time)
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
            status: stop.status || "pending",
            isPriority: !!stop.is_priority,
            // Postgres TIME comes back as "HH:MM:SS" - <input type="time"> wants "HH:MM"
            designatedTime: stop.designated_time ? stop.designated_time.slice(0, 5) : "",
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
        isPriority: false,
        designatedTime: "",
      },
    ])
  }

  const removeStop = (index: number) => {
    setStops(stops.filter((_, i) => i !== index))
  }

  const updateStop = (index: number, field: "pharmacyId" | "pharmacyName" | "pickupAddress" | "dropoffAddress" | "designatedTime", value: string) => {
    const newStops = [...stops]
    newStops[index] = { ...newStops[index], [field]: value }
    setStops(newStops)
  }

  const updateStopPriority = (index: number, isPriority: boolean) => {
    const newStops = [...stops]
    newStops[index] = { ...newStops[index], isPriority }
    setStops(newStops)
  }

  const formatLastDeliveredDate = (iso: string) => {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Turns a pasted Bing/Google Maps directions link (or a plain list of
  // addresses) into additional stops for the pharmacy picked in the
  // link-paste panel - see the identical helper in add-route-modal.tsx.
  const handleParseLinkForStops = () => {
    const pharmacy = pharmacies.find((p) => p.id === linkPastePharmacyId)
    if (!pharmacy) {
      toast({ title: "Select a pharmacy first", description: "Pick which pharmacy these stops are picked up from.", variant: "destructive" })
      return
    }
    const text = linkPasteText.trim()
    if (!text) {
      toast({ title: "Nothing to parse", description: "Paste a link or type addresses first.", variant: "destructive" })
      return
    }

    const appendStops = (addresses: string[]) => {
      setStops((prev) => [
        ...prev,
        ...addresses.map((address, i) => ({
          pharmacyId: pharmacy.id,
          pharmacyName: pharmacy.name,
          pickupAddress: pharmacy.address,
          dropoffAddress: address,
          stopOrder: prev.length + i + 1,
          isPriority: false,
          designatedTime: "",
        })),
      ])
      toast({ title: "Stops added", description: `Added ${addresses.length} stop(s) from ${pharmacy.name}.` })
      setShowLinkPaste(false)
      setLinkPasteText("")
    }

    const bingParsed = parseBingMapsLink(text)
    if (bingParsed) {
      appendStops(bingParsed.deliveryStops.map((s) => s.address))
      return
    }

    const googleParsed = parseGoogleMapsLink(text)
    if (googleParsed === "shortened") {
      toast({
        title: "That's a shortened Google Maps link",
        description: "Open it and paste the full address bar link instead - a shortened link can't be read directly.",
        variant: "destructive",
      })
      return
    }
    if (googleParsed) {
      if (googleParsed.deliveryStops.length === 0) {
        toast({ title: "No delivery stops found", description: "That link only had one address.", variant: "destructive" })
        return
      }
      appendStops(googleParsed.deliveryStops)
      return
    }

    const manual = parseManualAddressList(text)
    if (manual.length === 0) {
      toast({
        title: "Couldn't read that",
        description: "That doesn't look like a Bing or Google Maps directions link, and no addresses were found either.",
        variant: "destructive",
      })
      return
    }
    appendStops(manual)
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

    const timingWarning = checkPriorityTimingFeasibility()
    if (timingWarning) {
      toast({ title: "Heads up on timing", description: timingWarning })
    }

    if (seriesId) {
      setShowScopePrompt(true)
      return
    }

    await performUpdate("this")
  }

  // Soft heads-up only, not a hard rule - see the same check in
  // add-route-modal.tsx for the reasoning.
  const checkPriorityTimingFeasibility = (): string | null => {
    if (!startTime) return null
    const [sh, sm] = startTime.split(':').map((n) => parseInt(n, 10))
    const problems: string[] = []
    stops.forEach((stop, index) => {
      const isResolved = stop.status === 'delivered' || stop.status === 'failed' || stop.status === 'returned'
      if (!stop.isPriority || !stop.designatedTime || isResolved) return
      const etaMinutes = sh * 60 + sm + index * 30
      const [dh, dm] = stop.designatedTime.split(':').map((n) => parseInt(n, 10))
      const designatedMinutes = dh * 60 + dm
      if (designatedMinutes < etaMinutes) {
        problems.push(`Stop ${index + 1} (${stop.pharmacyName || stop.dropoffAddress})`)
      }
    })
    if (problems.length === 0) return null
    return `Based on stop order and a 30-min/stop estimate, the route may not reach ${problems.join(', ')} by its requested time. Consider moving it earlier or optimizing the route.`
  }

  const performUpdate = async (scope: "this" | "following") => {
    setIsSubmitting(true)
    try {
      const { updateRouteOccurrence } = await import('@/app/actions/data-actions')
      const result = await updateRouteOccurrence(
        routeId!,
        {
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
            isPriority: stop.isPriority || false,
            designatedTime: stop.isPriority ? stop.designatedTime || undefined : undefined,
          })),
        },
        scope,
      )

      toast({
        title: "Route Updated",
        description:
          scope === "following" && result.occurrencesUpdated > 1
            ? `Updated ${result.occurrencesUpdated} occurrences in this series.`
            : `${routeName} has been updated successfully`,
      })
      
      setShowScopePrompt(false)
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

            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <TimeSelect id="startTime" value={startTime} onChange={setStartTime} className="w-full" />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowLinkPaste((v) => !v)}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Paste Link
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addStop}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stop
                  </Button>
                </div>
              </div>

              {showLinkPaste && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div>
                    <Label htmlFor="linkPastePharmacy">Pharmacy (pickup for these stops) *</Label>
                    <Select value={linkPastePharmacyId} onValueChange={setLinkPastePharmacyId}>
                      <SelectTrigger id="linkPastePharmacy">
                        <SelectValue placeholder="Select pharmacy" />
                      </SelectTrigger>
                      <SelectContent>
                        {pharmacies.map((pharmacy) => (
                          <SelectItem key={pharmacy.id} value={pharmacy.id}>
                            {pharmacy.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="linkPasteText">Bing/Google Maps directions link, or addresses (one per line)</Label>
                    <Textarea
                      id="linkPasteText"
                      value={linkPasteText}
                      onChange={(e) => setLinkPasteText(e.target.value)}
                      placeholder={"https://www.bing.com/maps/directions?... or\n123 Main St, City, ST 00000\n456 Oak Ave, City, ST 00000"}
                      rows={3}
                      className="break-all"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={handleParseLinkForStops} disabled={!linkPasteText.trim() || !linkPastePharmacyId}>
                      Parse & Add Stops
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowLinkPaste(false)
                        setLinkPasteText("")
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {stops.map((stop, index) => {
                const isResolved = stop.status === "delivered" || stop.status === "failed" || stop.status === "returned"
                return (
                <div key={index} className={`border rounded-lg p-4 space-y-3 relative ${isResolved ? "bg-muted/50" : ""}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Stop {index + 1}</Badge>
                      {isResolved && (
                        <Badge
                          className={
                            stop.status === "delivered"
                              ? "bg-green-100 text-green-800"
                              : stop.status === "returned"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-red-100 text-red-800"
                          }
                        >
                          {stop.status === "delivered" ? "Delivered" : stop.status === "returned" ? "Returned" : "Failed"} - locked
                        </Badge>
                      )}
                    </div>
                    {stops.length > 1 && !isResolved && (
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
                  {isResolved && (
                    <p className="text-xs text-muted-foreground -mt-2">
                      This stop already has a real delivery outcome recorded and can't be changed here.
                    </p>
                  )}

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
                        disabled={isResolved}
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
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Label htmlFor={`dropoff-${index}`} className="mb-0">Dropoff Address *</Label>
                      {!isResolved && (
                        <button
                          type="button"
                          onClick={() => updateStopPriority(index, !stop.isPriority)}
                          title="Click to flag this address as a priority stop"
                          className={`flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 transition-colors shrink-0 ${
                            stop.isPriority
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                              : "bg-muted text-muted-foreground hover:bg-amber-50 hover:text-amber-700"
                          }`}
                        >
                          <Star className={`h-3 w-3 ${stop.isPriority ? "fill-amber-500" : ""}`} />
                          {stop.isPriority ? "Priority stop" : "Mark as priority"}
                        </button>
                      )}
                      {isResolved && stop.isPriority && (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-700 shrink-0">
                          <Star className="h-3 w-3 fill-amber-500" />
                          Priority stop
                        </span>
                      )}
                    </div>
                    <div className={stop.isPriority ? "rounded-md ring-2 ring-amber-300" : undefined}>
                      <AddressAutocompleteInput
                        id={`dropoff-${index}`}
                        placeholder="Start typing to search address..."
                        value={stop.dropoffAddress}
                        onChange={(value) => updateStop(index, "dropoffAddress", value)}
                        required
                        disabled={isResolved}
                      />
                    </div>
                    {stop.isPriority && (
                      <div className="flex items-center gap-2 mt-2">
                        <Label htmlFor={`designated-time-${index}`} className="text-xs text-amber-700 whitespace-nowrap">
                          Designated delivery time:
                        </Label>
                        <TimeSelect
                          id={`designated-time-${index}`}
                          value={stop.designatedTime}
                          onChange={(value) => updateStop(index, "designatedTime", value)}
                          disabled={isResolved}
                          className="w-40 h-8"
                        />
                      </div>
                    )}
                    {lastDriverByStop[index] && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <History className="h-3 w-3 shrink-0" />
                        Last delivered by <span className="font-medium text-foreground">{lastDriverByStop[index]!.driverName}</span>
                        {lastDriverByStop[index]!.deliveredAt && ` on ${formatLastDeliveredDate(lastDriverByStop[index]!.deliveredAt!)}`}
                      </p>
                    )}
                  </div>
                </div>
                )
              })}
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

      <AlertDialog open={showScopePrompt} onOpenChange={setShowScopePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply changes to...</AlertDialogTitle>
            <AlertDialogDescription>
              This route repeats on multiple days. Should these changes apply to just this occurrence, or to this and every later occurrence in the series?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2">
            <AlertDialogAction onClick={() => performUpdate("this")} disabled={isSubmitting} className="w-full">
              Just This Occurrence
            </AlertDialogAction>
            <AlertDialogAction onClick={() => performUpdate("following")} disabled={isSubmitting} className="w-full">
              This and Following Occurrences
            </AlertDialogAction>
            <AlertDialogCancel disabled={isSubmitting} className="w-full mt-0">
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

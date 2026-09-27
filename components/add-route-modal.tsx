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
import { Checkbox } from "@/components/ui/checkbox"
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
import { RouteOptimizerDialog } from "@/components/route-optimizer-dialog"
import { AddressAutocompleteInput } from "@/components/address-autocomplete-input"
import { TimeSelect } from "@/components/time-select"
import { geocodeAddress } from "@/lib/geocode"
import { REGION_FALLBACK_COORDS, type Region } from "@/lib/region-utils"
import { parseBingMapsLink, parseGoogleMapsLink, parseManualAddressList } from "@/lib/route-link-parser"

interface AddRouteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialDate?: Date | null
  copyFrom?: {
    name: string
    priority: string
    stops: RouteStopForm[]
  } | null
}

interface RouteStopForm {
  pharmacyId: string
  pharmacyName: string
  pickupAddress: string
  dropoffAddress: string
  isPriority?: boolean
  designatedTime?: string
}

export function AddRouteModal({ open, onOpenChange, onSuccess, initialDate, copyFrom }: AddRouteModalProps) {
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
      isPriority: false,
      designatedTime: "",
    },
  ])
  const [pharmacies, setPharmacies] = useState<Array<{ id: string; name: string; address: string; latitude?: number; longitude?: number; region?: string }>>([])
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [optimizedDurationMinutes, setOptimizedDurationMinutes] = useState<number | null>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [seriesEndDate, setSeriesEndDate] = useState("")
  const [seriesDriverId, setSeriesDriverId] = useState("")
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([])
  const [seriesConflicts, setSeriesConflicts] = useState<any[] | null>(null)
  const [lastDriverByStop, setLastDriverByStop] = useState<Record<number, { driverName: string; deliveredAt: string | null } | null>>({})
  const [showLinkPaste, setShowLinkPaste] = useState(false)
  const [linkPastePharmacyId, setLinkPastePharmacyId] = useState("")
  const [linkPasteText, setLinkPasteText] = useState("")

  // Looks up, per stop, who last actually delivered to that same
  // pharmacy+address pair - debounced so it doesn't fire a query on every
  // keystroke while an address is still being typed/autocompleted.
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(async () => {
      const { getLastDriverForStop } = await import('@/app/actions/data-actions')
      const results = await Promise.all(
        stops.map(async (stop, index) => {
          if (!stop.pharmacyId || !stop.dropoffAddress?.trim()) return [index, null] as const
          try {
            const info = await getLastDriverForStop(stop.pharmacyId, stop.dropoffAddress)
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
  }, [open, stops.map((s) => `${s.pharmacyId}|${s.dropoffAddress}`).join('||')])

  useEffect(() => {
    if (open) {
      loadPharmacies()
      loadDrivers()
      if (copyFrom) {
        setRouteName(`${copyFrom.name} (Copy)`)
        setPriority(copyFrom.priority)
        setStops(copyFrom.stops.length > 0 ? copyFrom.stops : [{ pharmacyId: "", pharmacyName: "", pickupAddress: "", dropoffAddress: "", isPriority: false, designatedTime: "" }])
      }
    }
  }, [open, copyFrom])

  const loadDrivers = async () => {
    try {
      const { getUsers } = await import('@/app/actions/data-actions')
      const users = await getUsers()
      setDrivers(
        users
          .filter((u: any) => u.role === 'driver')
          .map((u: any) => ({ id: u.id, name: `${u.first_name || ''} ${u.last_name || ''}`.trim() })),
      )
    } catch (error) {
      console.error('Error loading drivers:', error)
    }
  }

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
        region: p.region,
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
        isPriority: false,
        designatedTime: "",
      },
    ])
  }

  const removeStop = (index: number) => {
    setStops(stops.filter((_, i) => i !== index))
  }

  const updateStop = (index: number, field: keyof RouteStopForm, value: string) => {
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
  // addresses) into stops for the pharmacy picked in the link-paste panel,
  // the same parsing pharmacies already use in their own Request-a-Route
  // dialog. Unlike that dialog, every stop here needs a pharmacyId, so the
  // admin picks one pharmacy up front and every parsed address becomes a
  // dropoff under it.
  const handleParseLinkForStops = async () => {
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

    const buildStops = (addresses: string[]): RouteStopForm[] =>
      addresses.map((address) => ({
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.name,
        pickupAddress: pharmacy.address,
        dropoffAddress: address,
        isPriority: false,
        designatedTime: "",
      }))

    const appendStops = (newStops: RouteStopForm[]) => {
      setStops((prev) => {
        // Don't leave a dangling blank row in front of the parsed stops.
        const isBlank = (s: RouteStopForm) => !s.pharmacyId && !s.dropoffAddress
        const base = prev.length === 1 && isBlank(prev[0]) ? [] : prev
        return [...base, ...newStops]
      })
      toast({ title: "Stops added", description: `Added ${newStops.length} stop(s) from ${pharmacy.name}.` })
      setShowLinkPaste(false)
      setLinkPasteText("")
    }

    const bingParsed = parseBingMapsLink(text)
    if (bingParsed) {
      appendStops(buildStops(bingParsed.deliveryStops.map((s) => s.address)))
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

    let addresses: string[] | null = null
    if (googleParsed) {
      if (googleParsed.deliveryStops.length === 0) {
        toast({ title: "No delivery stops found", description: "That link only had one address.", variant: "destructive" })
        return
      }
      addresses = googleParsed.deliveryStops
    } else {
      const manual = parseManualAddressList(text)
      if (manual.length === 0) {
        toast({
          title: "Couldn't read that",
          description: "That doesn't look like a Bing or Google Maps directions link, and no addresses were found either.",
          variant: "destructive",
        })
        return
      }
      addresses = manual
    }

    // Coordinates for these stops are picked up later, the same way any
    // manually-typed stop's address gets resolved - via the address
    // autocomplete field, or when "Optimize" is run.
    appendStops(buildStops(addresses))
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

    if (isRecurring && daysOfWeek.length === 0) {
      toast({ title: "Select at least one day", description: "Choose which days this route repeats on.", variant: "destructive" })
      return
    }

    const timingWarning = checkPriorityTimingFeasibility()
    if (timingWarning) {
      toast({ title: "Heads up on timing", description: timingWarning })
    }

    await submitRoute(false)
  }

  // Soft heads-up only, not a hard rule - flags a priority stop whose
  // designated time looks earlier than the route could realistically reach
  // it, using the same 30-min-per-stop heuristic used everywhere else in
  // this app for an estimate before a real duration exists. Doesn't block
  // submission since it's just an estimate and the admin may know better
  // (a shorter real distance, a route that starts earlier than shown, etc).
  const checkPriorityTimingFeasibility = (): string | null => {
    if (!startTime) return null
    const [sh, sm] = startTime.split(':').map((n) => parseInt(n, 10))
    const problems: string[] = []
    stops.forEach((stop, index) => {
      if (!stop.isPriority || !stop.designatedTime) return
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

  const submitRoute = async (confirmDespiteConflicts: boolean) => {
    setIsSubmitting(true)
    try {
      const startDate = initialDate
        ? `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, '0')}-${String(initialDate.getDate()).padStart(2, '0')}`
        : undefined

      const formattedStops = stops.map((stop, index) => ({
        pharmacyId: stop.pharmacyId,
        pickupAddress: stop.pickupAddress,
        dropoffAddress: stop.dropoffAddress,
        sequence: index + 1,
        isPriority: stop.isPriority || false,
        designatedTime: stop.isPriority ? stop.designatedTime || undefined : undefined,
      }))

      if (isRecurring) {
        const { createRouteSeries } = await import('@/app/actions/data-actions')
        const result = await createRouteSeries({
          name: routeName,
          driverId: seriesDriverId || null,
          priority,
          startTime: startTime || undefined,
          estimatedDuration: optimizedDurationMinutes ?? (validStopCount > 0 ? recommendedDurationMinutes : undefined),
          daysOfWeek,
          seriesStartDate: startDate || new Date().toISOString().split('T')[0],
          seriesEndDate: seriesEndDate || undefined,
          stops: formattedStops,
          confirmDespiteConflicts,
        })

        if (result.conflicts.length > 0) {
          setSeriesConflicts(result.conflicts)
          setIsSubmitting(false)
          return
        }

        toast({
          title: "Recurring Route Created",
          description: `${routeName} was created for ${result.routes.length} date${result.routes.length !== 1 ? "s" : ""}.`,
        })
      } else {
        const { createRoute } = await import('@/app/actions/data-actions')
        await createRoute({
          name: routeName,
          startDate,
          startTime: startTime || undefined,
          estimatedDuration: optimizedDurationMinutes ?? (validStopCount > 0 ? recommendedDurationMinutes : undefined),
          priority,
          stops: formattedStops,
        })
        toast({
          title: "Route Created",
          description: `${routeName} has been created successfully`,
        })
      }
      
      setSeriesConflicts(null)
      // Reset form
      setRouteName("")
      setStartTime("")
      setOptimizedDurationMinutes(null)
      setPriority("medium")
      setIsRecurring(false)
      setDaysOfWeek([])
      setSeriesEndDate("")
      setSeriesDriverId("")
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
          // A stop flagged priority gets pulled to the front of the
          // optimizer's nearest-neighbor search regardless of the route's
          // own priority level - otherwise "Optimize" could easily bump a
          // priority stop to the very end for the sake of travel distance,
          // defeating the point of flagging it.
          priority: (stop.isPriority ? "urgent" : priority) as "urgent" | "high" | "medium" | "low",
          isPriorityStop: stop.isPriority || false,
          designatedTime: stop.designatedTime || undefined,
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

    // Last resort if geocoding fails entirely (e.g. malformed address) -
    // the pharmacy's own region center, better than a fixed point that
    // could be a whole state away from where it actually is.
    return REGION_FALLBACK_COORDS[pharmacy?.region as Region] || { lat: 39.8283, lng: -98.5795 }
  }

  const handleOptimizedStops = (optimizedStops: any[], estimatedDuration?: number) => {
    // Same filter prepareStopsForOptimization used to build the list the
    // optimizer actually saw - its "stop-<n>" ids below refer to positions
    // in this filtered array, not the raw `stops` state.
    const validStops = stops.filter((s) => s.pharmacyId && s.dropoffAddress)

    const reorderedStops = optimizedStops.map((opt) => {
      // Match back by the id assigned in prepareStopsForOptimization
      // ("stop-<index>"), not by pharmacy_id - a pharmacy can have several
      // stops in the same route (e.g. delivering to multiple patient
      // addresses), and matching by pharmacy_id alone meant .find() always
      // resolved to the FIRST such stop, so every one of them came back
      // with that same stop's dropoff address, priority flag, and time.
      const match = typeof opt.id === "string" ? opt.id.match(/^stop-(\d+)$/) : null
      const originalStop = match ? validStops[Number(match[1])] : undefined

      if (originalStop) {
        // Return the complete original stop with all its data intact
        return {
          pharmacyId: originalStop.pharmacyId,
          pharmacyName: originalStop.pharmacyName,
          pickupAddress: originalStop.pickupAddress,
          dropoffAddress: originalStop.dropoffAddress,
          isPriority: originalStop.isPriority,
          designatedTime: originalStop.designatedTime,
        }
      }

      // Fallback (should not happen in normal operation)
      return {
        pharmacyId: "",
        pharmacyName: "",
        pickupAddress: "",
        dropoffAddress: "",
        isPriority: false,
        designatedTime: "",
      }
    })

    setStops(reorderedStops)
    if (estimatedDuration != null) {
      setOptimizedDurationMinutes(Math.round(estimatedDuration))
    }
    
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

  // Falls back to a simple 30-min-per-stop heuristic (matching the default
  // used everywhere else in the app) until the admin runs Optimize, which
  // gives a real distance-based estimate instead. This estimate is what the
  // server uses to derive end_time automatically - there's no separate end
  // time to enter.
  const validStopCount = stops.filter((s) => s.pharmacyId && s.dropoffAddress).length
  const recommendedDurationMinutes = optimizedDurationMinutes ?? validStopCount * 30
  const recommendedDurationLabel =
    recommendedDurationMinutes >= 60
      ? `${Math.floor(recommendedDurationMinutes / 60)}h ${recommendedDurationMinutes % 60}m`
      : `${recommendedDurationMinutes} min`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
            <MapIcon className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{copyFrom ? "Copy Route" : "Create New Route"}</DialogTitle>
          {initialDate && (
            <p className="text-center text-sm text-muted-foreground">
              Scheduling for{" "}
              {initialDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          )}
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

          <div>
            <Label htmlFor="startTime">Start Time</Label>
            <TimeSelect id="startTime" value={startTime} onChange={setStartTime} className="w-full" />
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox id="isRecurring" checked={isRecurring} onCheckedChange={(c) => setIsRecurring(!!c)} />
              <Label htmlFor="isRecurring" className="font-medium cursor-pointer">
                Repeat this route on multiple days
              </Label>
            </div>

            {isRecurring && (
              <div className="space-y-3 pt-1">
                <div>
                  <Label>Repeat On *</Label>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, dayIndex) => (
                      <button
                        key={dayIndex}
                        type="button"
                        onClick={() =>
                          setDaysOfWeek((prev) =>
                            prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex],
                          )
                        }
                        className={`h-9 w-12 rounded-md border text-sm font-medium transition-colors ${
                          daysOfWeek.includes(dayIndex)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent hover:bg-muted"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="seriesEndDate">Repeat Until (optional)</Label>
                    <Input
                      id="seriesEndDate"
                      type="date"
                      value={seriesEndDate}
                      onChange={(e) => setSeriesEndDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="seriesDriver">Assign Driver</Label>
                    <Select value={seriesDriverId} onValueChange={setSeriesDriverId}>
                      <SelectTrigger id="seriesDriver">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Creates a separate route for each matching date - each one can be worked, edited, or confirmed independently.
                  {!seriesEndDate && " Leave the end date blank to repeat for the next 3 months."}
                </p>
              </div>
            )}
          </div>

          {recommendedDurationMinutes > 0 && (
            <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                Estimated duration: <span className="font-medium text-foreground">{recommendedDurationLabel}</span>
                {optimizedDurationMinutes == null && " (est. 30 min/stop - run Optimize for a distance-based estimate)"}
              </span>
            </div>
          )}

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
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Label htmlFor={`dropoff-${index}`} className="mb-0">Dropoff Address *</Label>
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
                  </div>
                  <div className={stop.isPriority ? "rounded-md ring-2 ring-amber-300" : undefined}>
                    <AddressAutocompleteInput
                      id={`dropoff-${index}`}
                      placeholder="Start typing to search address..."
                      value={stop.dropoffAddress}
                      onChange={(value) => updateStop(index, "dropoffAddress", value)}
                      required
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

      <AlertDialog open={!!seriesConflicts} onOpenChange={(o) => !o && setSeriesConflicts(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scheduling Conflicts Found</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  This driver already has routes overlapping {seriesConflicts?.length} of the dates in this series:
                </p>
                <ul className="text-sm max-h-40 overflow-y-auto space-y-1">
                  {seriesConflicts?.map((c: any) => (
                    <li key={c.label}>
                      <span className="font-medium text-foreground">{c.label}</span> - conflicts with{" "}
                      {c.conflictsWith.map((r: any) => r.name).join(", ")}
                    </li>
                  ))}
                </ul>
                <p>Create the whole series anyway?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSeriesConflicts(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => submitRoute(true)}>Create Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

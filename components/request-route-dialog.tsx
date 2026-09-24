"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, MapPin, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { parseBingMapsLink, parseGoogleMapsLink, parseManualAddressList } from "@/lib/route-link-parser"

interface RequestRouteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted: () => void
}

interface PreviewStop {
  address: string
  lat: number | null
  lng: number | null
}

export function RequestRouteDialog({ open, onOpenChange, onSubmitted }: RequestRouteDialogProps) {
  const { toast } = useToast()
  const [linkText, setLinkText] = useState("")
  const [manualText, setManualText] = useState("")
  const [previewStops, setPreviewStops] = useState<PreviewStop[]>([])
  const [isEmergency, setIsEmergency] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const resetAndClose = () => {
    setLinkText("")
    setManualText("")
    setPreviewStops([])
    setIsEmergency(false)
    onOpenChange(false)
  }

  const handleParseLink = async () => {
    const bingParsed = parseBingMapsLink(linkText.trim())
    if (bingParsed) {
      setPreviewStops(bingParsed.deliveryStops.map((s) => ({ address: s.address, lat: s.lat, lng: s.lng })))
      toast({ title: "Link parsed", description: `Found ${bingParsed.deliveryStops.length} delivery stop(s).` })
      return
    }

    const googleParsed = parseGoogleMapsLink(linkText.trim())
    if (googleParsed === "shortened") {
      toast({
        title: "That's a shortened Google Maps link",
        description: "Please open it and paste the full address bar link instead - a shortened link can't be read directly.",
        variant: "destructive",
      })
      return
    }
    if (googleParsed) {
      if (googleParsed.deliveryStops.length === 0) {
        toast({
          title: "No delivery stops found",
          description: "That link only had one address. You can still type addresses manually below.",
          variant: "destructive",
        })
        return
      }
      setParsing(true)
      try {
        const { geocodeAddress } = await import("@/lib/geocode")
        const stops: PreviewStop[] = []
        for (const address of googleParsed.deliveryStops) {
          const coords = await geocodeAddress(address)
          stops.push({ address, lat: coords?.lat ?? null, lng: coords?.lng ?? null })
          // Nominatim's usage policy caps requests at ~1/second
          await new Promise((resolve) => setTimeout(resolve, 1100))
        }
        setPreviewStops(stops)
        toast({ title: "Link parsed", description: `Found ${stops.length} delivery stop(s).` })
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" })
      } finally {
        setParsing(false)
      }
      return
    }

    toast({
      title: "Couldn't read that link",
      description: "That doesn't look like a Bing or Google Maps directions link. You can still type addresses manually below.",
      variant: "destructive",
    })
  }

  const handleUseManualList = async () => {
    const addresses = parseManualAddressList(manualText)
    if (addresses.length === 0) {
      toast({ title: "No addresses found", description: "Enter at least one address, one per line.", variant: "destructive" })
      return
    }
    setParsing(true)
    try {
      const { geocodeAddress } = await import("@/lib/geocode")
      const stops: PreviewStop[] = []
      for (const address of addresses) {
        const coords = await geocodeAddress(address)
        stops.push({ address, lat: coords?.lat ?? null, lng: coords?.lng ?? null })
        // Nominatim's usage policy caps requests at ~1/second
        await new Promise((resolve) => setTimeout(resolve, 1100))
      }
      setPreviewStops(stops)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setParsing(false)
    }
  }

  const handleRemoveStop = (index: number) => {
    setPreviewStops((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (previewStops.length === 0) {
      toast({ title: "No stops to submit", description: "Parse a link or enter addresses first.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const { createRouteRequest } = await import("@/app/actions/data-actions")
      await createRouteRequest({
        stops: previewStops,
        isEmergency,
        sourceLink: linkText.trim() || null,
      })
      toast({
        title: "Request sent",
        description: isEmergency
          ? "Marked as emergency - dispatch has been notified."
          : "An admin will assign a driver shortly.",
      })
      onSubmitted()
      resetAndClose()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : resetAndClose())}>
      <DialogContent className="max-h-[85vh] overflow-y-auto overflow-x-hidden break-words sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request a Route</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="link">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="link">Paste a Link</TabsTrigger>
            <TabsTrigger value="manual">Type Addresses</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-3 pt-4">
            <Label htmlFor="linkInput">Bing or Google Maps directions link</Label>
            <Textarea
              id="linkInput"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="https://www.bing.com/maps/directions?... or https://www.google.com/maps/dir/..."
              rows={3}
              className="break-all"
            />
            <Button type="button" variant="outline" onClick={handleParseLink} disabled={!linkText.trim() || parsing} className="w-full">
              {parsing ? "Looking up addresses..." : "Parse Link"}
            </Button>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 pt-4">
            <Label htmlFor="manualInput">Delivery addresses, one per line</Label>
            <Textarea
              id="manualInput"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={"123 Main St, City, ST 00000\n456 Oak Ave, City, ST 00000"}
              rows={5}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleUseManualList}
              disabled={!manualText.trim() || parsing}
              className="w-full"
            >
              {parsing ? "Looking up addresses..." : "Use These Addresses"}
            </Button>
          </TabsContent>
        </Tabs>

        {previewStops.length > 0 && (
          <div className="space-y-2 pt-2">
            <Label>{previewStops.length} Stop{previewStops.length !== 1 ? "s" : ""}</Label>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {previewStops.map((stop, index) => (
                <div key={index} className="flex items-center justify-between gap-2 text-sm p-2 bg-muted/50 rounded">
                  <div className="flex items-start gap-2 min-w-0">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="truncate">{stop.address}</p>
                      {stop.lat == null && (
                        <p className="text-xs text-destructive">Couldn't locate this address - an admin will need to fix it.</p>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveStop(index)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start space-x-2 pt-2">
          <Checkbox id="isEmergency" checked={isEmergency} onCheckedChange={(c) => setIsEmergency(!!c)} className="mt-1" />
          <Label htmlFor="isEmergency" className="cursor-pointer font-normal">
            <span className="flex items-center gap-1 font-medium">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              This is an emergency delivery
            </span>
            <span className="text-sm text-muted-foreground block">Dispatch will be notified immediately.</span>
          </Label>
        </div>

        <Button onClick={handleSubmit} disabled={submitting || previewStops.length === 0} className="w-full">
          {submitting ? "Submitting..." : "Send Request"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useEffect } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"

interface PharmacyDeliverySettingsProps {
  /** Triggers the (re)load - pass the parent settings dialog's open state. */
  open: boolean
}

export function PharmacyDeliverySettings({ open }: PharmacyDeliverySettingsProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<"batch" | "per_item">("batch")
  const [trackingEnabled, setTrackingEnabled] = useState(false)
  const [barcodeScanningEnabled, setBarcodeScanningEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoading(true)
      try {
        const {
          getOwnPharmacyReturnSignatureMode,
          getOwnPharmacyTrackingEnabled,
          getOwnPharmacyBarcodeScanningEnabled,
        } = await import("@/app/actions/data-actions")
        const [currentMode, currentTracking, currentScanning] = await Promise.all([
          getOwnPharmacyReturnSignatureMode(),
          getOwnPharmacyTrackingEnabled(),
          getOwnPharmacyBarcodeScanningEnabled(),
        ])
        setMode(currentMode)
        setTrackingEnabled(currentTracking)
        setBarcodeScanningEnabled(currentScanning)
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open])

  const handleSave = async () => {
    setSaving(true)
    try {
      const {
        updateOwnPharmacyReturnSignatureMode,
        updateOwnPharmacyTrackingEnabled,
        updateOwnPharmacyBarcodeScanningEnabled,
      } = await import("@/app/actions/data-actions")
      await Promise.all([
        updateOwnPharmacyReturnSignatureMode(mode),
        updateOwnPharmacyTrackingEnabled(trackingEnabled),
        updateOwnPharmacyBarcodeScanningEnabled(barcodeScanningEnabled),
      ])
      toast({ title: "Saved", description: "Your delivery settings have been updated." })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 rounded-md border p-3">
        <div>
          <Label htmlFor="tracking-toggle" className="font-medium cursor-pointer">
            Customer Tracking Links
          </Label>
          <p className="text-sm text-muted-foreground">
            Give each delivery a link your customers can use to check its status - no account needed. The
            link never shows their name, address, or what's being delivered, just the delivery's progress.
          </p>
        </div>
        <Switch id="tracking-toggle" checked={trackingEnabled} onCheckedChange={setTrackingEnabled} />
      </div>

      <div className="flex items-start justify-between gap-3 rounded-md border p-3">
        <div>
          <Label htmlFor="scanning-toggle" className="font-medium cursor-pointer">
            Barcode Scanning
          </Label>
          <p className="text-sm text-muted-foreground">
            Let your staff scan each package's existing label while packing, and let drivers scan at pickup
            and delivery to double-check they have the right package. This is an extra check alongside the
            normal buttons - it never blocks anyone from proceeding.
          </p>
        </div>
        <Switch id="scanning-toggle" checked={barcodeScanningEnabled} onCheckedChange={setBarcodeScanningEnabled} />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Failed Delivery Returns</p>
        <p className="text-sm text-muted-foreground">
          When a driver returns items that couldn't be delivered, choose how you'd like to confirm receipt.
        </p>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as "batch" | "per_item")}>
          <div className="flex items-start space-x-3 rounded-md border p-3">
            <RadioGroupItem value="batch" id="mode-batch" className="mt-1" />
            <Label htmlFor="mode-batch" className="cursor-pointer font-normal">
              <span className="font-medium block">One signature for the whole batch</span>
              <span className="text-sm text-muted-foreground">
                Sign once to confirm receipt of everything a driver is returning at once.
              </span>
            </Label>
          </div>
          <div className="flex items-start space-x-3 rounded-md border p-3">
            <RadioGroupItem value="per_item" id="mode-per-item" className="mt-1" />
            <Label htmlFor="mode-per-item" className="cursor-pointer font-normal">
              <span className="font-medium block">A separate signature for each item</span>
              <span className="text-sm text-muted-foreground">
                Sign individually to confirm receipt of each returned delivery.
              </span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save Delivery Settings"}
      </Button>
    </div>
  )
}

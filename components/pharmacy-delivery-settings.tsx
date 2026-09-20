"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface PharmacyDeliverySettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PharmacyDeliverySettings({ open, onOpenChange }: PharmacyDeliverySettingsProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<"batch" | "per_item">("batch")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoading(true)
      try {
        const { getOwnPharmacyReturnSignatureMode } = await import("@/app/actions/data-actions")
        const current = await getOwnPharmacyReturnSignatureMode()
        setMode(current)
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
      const { updateOwnPharmacyReturnSignatureMode } = await import("@/app/actions/data-actions")
      await updateOwnPharmacyReturnSignatureMode(mode)
      toast({ title: "Saved", description: "Your return delivery preference has been updated." })
      onOpenChange(false)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Failed Delivery Returns</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
        ) : (
          <div className="space-y-4">
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
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Preference"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

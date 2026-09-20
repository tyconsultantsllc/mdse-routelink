"use client"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Package, MapPin } from "lucide-react"
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad"
import { useToast } from "@/hooks/use-toast"

interface ReturnStop {
  stopId: number
  routeId: number
  dropoffAddress: string
  failureReason?: string
}

interface ReturnGroup {
  pharmacyId: string
  pharmacyName: string
  pharmacyAddress: string | null
  stops: ReturnStop[]
}

interface ReturnToPharmacyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: ReturnGroup[]
  driverId: string
  currentLocation: { lat: number; lng: number }
  onConfirmed: () => void
}

export function ReturnToPharmacyDialog({
  open,
  onOpenChange,
  groups,
  driverId,
  currentLocation,
  onConfirmed,
}: ReturnToPharmacyDialogProps) {
  const { toast } = useToast()
  const sigRef = useRef<SignaturePadHandle>(null)

  const [selectedGroup, setSelectedGroup] = useState<ReturnGroup | null>(null)
  const [mode, setMode] = useState<"batch" | "per_item" | null>(null)
  const [loadingMode, setLoadingMode] = useState(false)
  const [itemIndex, setItemIndex] = useState(0)
  const [confirmedBy, setConfirmedBy] = useState("")
  const [hasSignature, setHasSignature] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Reset to the picker view whenever the dialog is reopened.
  useEffect(() => {
    if (open) {
      setSelectedGroup(null)
      setMode(null)
      setItemIndex(0)
      setConfirmedBy("")
      setHasSignature(false)
    }
  }, [open])

  const handleSelectGroup = async (group: ReturnGroup) => {
    setSelectedGroup(group)
    setLoadingMode(true)
    try {
      const { getPharmacyReturnSignatureMode } = await import("@/app/actions/data-actions")
      const pharmacyMode = await getPharmacyReturnSignatureMode(group.pharmacyId)
      setMode(pharmacyMode)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
      setSelectedGroup(null)
    } finally {
      setLoadingMode(false)
    }
  }

  const handleBack = () => {
    if (mode === "per_item" && itemIndex > 0) {
      setItemIndex((i) => i - 1)
      setConfirmedBy("")
      sigRef.current?.clear()
      setHasSignature(false)
      return
    }
    setSelectedGroup(null)
    setMode(null)
    setItemIndex(0)
  }

  const submitReturn = async (stops: ReturnStop[]) => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast({ title: "Signature required", description: "Please sign to confirm the return.", variant: "destructive" })
      return
    }
    if (!confirmedBy.trim()) {
      toast({ title: "Name required", description: "Please enter who's confirming receipt.", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const { confirmReturnToPharmacy } = await import("@/lib/driver-actions")
      await confirmReturnToPharmacy({
        stops: stops.map((s) => ({ stopId: s.stopId, routeId: s.routeId, pharmacyId: selectedGroup!.pharmacyId })),
        driverId,
        confirmedBy: confirmedBy.trim(),
        signatureDataUrl: sigRef.current.toDataURL(),
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
      })

      if (mode === "per_item" && itemIndex < (selectedGroup?.stops.length ?? 0) - 1) {
        toast({ title: "Confirmed", description: "Item marked as returned." })
        setItemIndex((i) => i + 1)
        setConfirmedBy("")
        sigRef.current.clear()
        setHasSignature(false)
      } else {
        toast({ title: "Return confirmed", description: "Thanks - all items have been marked as returned." })
        onConfirmed()
        onOpenChange(false)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {selectedGroup && (
              <Button variant="ghost" size="icon" className="h-7 w-7 -ml-2" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {selectedGroup ? `Return to ${selectedGroup.pharmacyName}` : "Pending Returns"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Step 1: pick which pharmacy's items to return */}
        {!selectedGroup && (
          <div className="space-y-3">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No failed deliveries are waiting to be returned.
              </p>
            ) : (
              groups.map((group) => (
                <button
                  key={group.pharmacyId}
                  onClick={() => handleSelectGroup(group)}
                  className="w-full text-left p-4 border rounded-lg hover:bg-muted/50 active:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{group.pharmacyName}</span>
                    </div>
                    <Badge variant="secondary">{group.stops.length} item{group.stops.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  {group.pharmacyAddress && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {group.pharmacyAddress}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* Step 2: loading the pharmacy's preference */}
        {selectedGroup && loadingMode && (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
        )}

        {/* Step 3a: batch mode - one signature for everything */}
        {selectedGroup && !loadingMode && mode === "batch" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Items being returned ({selectedGroup.stops.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedGroup.stops.map((s) => (
                  <div key={s.stopId} className="text-sm p-2 bg-muted/50 rounded">
                    <p className="font-medium">{s.dropoffAddress}</p>
                    {s.failureReason && <p className="text-xs text-muted-foreground">{s.failureReason}</p>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="confirmedBy">Received by</Label>
              <Input
                id="confirmedBy"
                value={confirmedBy}
                onChange={(e) => setConfirmedBy(e.target.value)}
                placeholder="Name of pharmacy staff"
              />
            </div>
            <div>
              <Label>Signature</Label>
              <SignaturePad ref={sigRef} onChange={setHasSignature} />
            </div>
            <Button
              onClick={() => submitReturn(selectedGroup.stops)}
              disabled={submitting || !hasSignature}
              className="w-full"
            >
              {submitting ? "Confirming..." : `Confirm All ${selectedGroup.stops.length} Item${selectedGroup.stops.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        )}

        {/* Step 3b: per-item mode - step through one at a time */}
        {selectedGroup && !loadingMode && mode === "per_item" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Item {itemIndex + 1} of {selectedGroup.stops.length}
              </p>
            </div>
            <div className="text-sm p-3 bg-muted/50 rounded">
              <p className="font-medium">{selectedGroup.stops[itemIndex].dropoffAddress}</p>
              {selectedGroup.stops[itemIndex].failureReason && (
                <p className="text-xs text-muted-foreground">{selectedGroup.stops[itemIndex].failureReason}</p>
              )}
            </div>
            <div>
              <Label htmlFor="confirmedByItem">Received by</Label>
              <Input
                id="confirmedByItem"
                value={confirmedBy}
                onChange={(e) => setConfirmedBy(e.target.value)}
                placeholder="Name of pharmacy staff"
              />
            </div>
            <div>
              <Label>Signature</Label>
              <SignaturePad ref={sigRef} onChange={setHasSignature} />
            </div>
            <Button
              onClick={() => submitReturn([selectedGroup.stops[itemIndex]])}
              disabled={submitting || !hasSignature}
              className="w-full"
            >
              {submitting
                ? "Confirming..."
                : itemIndex < selectedGroup.stops.length - 1
                  ? "Confirm & Next Item"
                  : "Confirm Last Item"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

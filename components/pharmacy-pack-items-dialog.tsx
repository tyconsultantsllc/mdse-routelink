"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BarcodeScannerDialog } from "@/components/barcode-scanner-dialog"
import { ScanLine, X, Package } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"

interface PharmacyPackItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routeStopId: number | null
  deliveryName: string
}

export function PharmacyPackItemsDialog({ open, onOpenChange, routeStopId, deliveryName }: PharmacyPackItemsDialogProps) {
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scannerOpen, setScannerOpen] = useState(false)

  const loadItems = async () => {
    if (!routeStopId) return
    setLoading(true)
    try {
      const { getStopItems } = await import("@/app/actions/data-actions")
      const result = await getStopItems(routeStopId)
      setItems(result)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadItems()
  }, [open, routeStopId])

  const handleScan = async (barcode: string) => {
    if (!routeStopId) return
    try {
      const { recordPackedItem } = await import("@/app/actions/data-actions")
      await recordPackedItem(routeStopId, barcode)
      toast({ title: "Package scanned", description: barcode })
      loadItems()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleRemove = async (itemId: string) => {
    try {
      const { removePackedItem } = await import("@/app/actions/data-actions")
      await removePackedItem(itemId)
      loadItems()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Packages</DialogTitle>
            <DialogDescription>{deliveryName}</DialogDescription>
          </DialogHeader>

          <Button onClick={() => setScannerOpen(true)} className="w-full">
            <ScanLine className="h-4 w-4 mr-2" />
            Scan a Package
          </Button>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No packages scanned yet for this delivery.
              </p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 p-2 border rounded-md text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate font-mono">{item.barcode}</span>
                  </div>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
        title="Scan Package"
        description={`Adding a package to ${deliveryName}`}
        continuous
      />
    </>
  )
}

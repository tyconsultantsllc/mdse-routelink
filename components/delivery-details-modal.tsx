"use client"

import { useState } from "react"
import { FileSignature } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface DeliveryDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  delivery: any
}

export function DeliveryDetailsModal({ open, onOpenChange, delivery }: DeliveryDetailsModalProps) {
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [loadingSignature, setLoadingSignature] = useState(false)

  if (!delivery) return null

  const handleViewSignature = async () => {
    setLoadingSignature(true)
    try {
      const { getDeliverySignatureUrl } = await import("@/app/actions/data-actions")
      const url = await getDeliverySignatureUrl(delivery.routeStopId)
      setSignatureUrl(url)
    } catch (error) {
      console.error("Error loading signature:", error)
    } finally {
      setLoadingSignature(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setSignatureUrl(null)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delivery Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Route</p>
              <p className="font-medium">{delivery.routeName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Driver</p>
              <p className="font-medium">{delivery.driver}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pharmacy</p>
              <p className="font-medium">{delivery.pharmacy}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date & Time</p>
              <p className="font-medium">
                {delivery.date} at {delivery.time}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Dropoff Address</p>
            <p className="font-medium">{delivery.dropoffAddress}</p>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge className={delivery.status === "completed" ? "bg-green-500" : "bg-destructive"}>
              {delivery.status === "completed" ? "Delivered" : "Failed"}
            </Badge>
          </div>

          {delivery.status === "completed" && delivery.recipientName && (
            <div>
              <p className="text-xs text-muted-foreground">Signed By</p>
              <p className="font-medium">{delivery.recipientName}</p>
            </div>
          )}

          {delivery.status === "failed" && delivery.failureReason && (
            <div>
              <p className="text-xs text-muted-foreground">Failure Reason</p>
              <p className="font-medium text-destructive">{delivery.failureReason}</p>
            </div>
          )}

          {delivery.hasSignature && !signatureUrl && (
            <Button variant="outline" size="sm" onClick={handleViewSignature} disabled={loadingSignature}>
              <FileSignature className="h-4 w-4 mr-2" />
              {loadingSignature ? "Loading..." : "View Signature"}
            </Button>
          )}

          {signatureUrl && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Signature</p>
              <img
                src={signatureUrl || "/placeholder.svg"}
                alt="Delivery signature"
                className="w-full rounded-md border bg-white"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

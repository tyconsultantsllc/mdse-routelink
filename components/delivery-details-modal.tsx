"use client"

import { useState } from "react"
import { FileSignature } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface DeliveryDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  delivery: any
}

export function DeliveryDetailsModal({ open, onOpenChange, delivery }: DeliveryDetailsModalProps) {
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [loadingSignature, setLoadingSignature] = useState(false)
  const { toast } = useToast()

  if (!delivery) return null

  const handleViewSignature = async (type: "delivery" | "return" = "delivery") => {
    setLoadingSignature(true)
    try {
      const { getDeliverySignatureUrl } = await import("@/app/actions/data-actions")
      const url = await getDeliverySignatureUrl(delivery.routeStopId, type)
      setSignatureUrl(url)
    } catch (error: any) {
      toast({
        title: "Couldn't load signature",
        description: error?.message || "Unknown error",
        variant: "destructive",
      })
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
            <Badge
              className={
                delivery.status === "completed"
                  ? "bg-green-500"
                  : delivery.status === "returned"
                    ? "bg-purple-500"
                    : "bg-destructive"
              }
            >
              {delivery.status === "completed" ? "Delivered" : delivery.status === "returned" ? "Returned" : "Failed"}
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

          {delivery.status === "returned" && (
            <>
              {delivery.failureReason && (
                <div>
                  <p className="text-xs text-muted-foreground">Original Failure Reason</p>
                  <p className="font-medium">{delivery.failureReason}</p>
                </div>
              )}
              {delivery.returnConfirmedBy && (
                <div>
                  <p className="text-xs text-muted-foreground">Received Back By</p>
                  <p className="font-medium">{delivery.returnConfirmedBy}</p>
                </div>
              )}
              {delivery.returnConfirmedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Returned At</p>
                  <p className="font-medium">{delivery.returnConfirmedAt}</p>
                </div>
              )}
            </>
          )}

          {delivery.status === "completed" && delivery.hasSignature && !signatureUrl && (
            <Button variant="outline" size="sm" onClick={() => handleViewSignature("delivery")} disabled={loadingSignature}>
              <FileSignature className="h-4 w-4 mr-2" />
              {loadingSignature ? "Loading..." : "View Signature"}
            </Button>
          )}

          {delivery.status === "completed" && !delivery.hasSignature && (
            <p className="text-xs text-muted-foreground italic">No signature on file for this delivery.</p>
          )}

          {delivery.status === "returned" && delivery.hasReturnSignature && !signatureUrl && (
            <Button variant="outline" size="sm" onClick={() => handleViewSignature("return")} disabled={loadingSignature}>
              <FileSignature className="h-4 w-4 mr-2" />
              {loadingSignature ? "Loading..." : "View Return Signature"}
            </Button>
          )}

          {delivery.status === "returned" && !delivery.hasReturnSignature && (
            <p className="text-xs text-muted-foreground italic">No return signature on file.</p>
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

          {delivery.latitude != null && delivery.longitude != null && (
            <div>
              <p className="text-xs text-muted-foreground">
                {delivery.status === "completed" ? "Signature Captured At" : "Location When Marked Failed"}
              </p>
              <a
                href={`https://www.google.com/maps?q=${delivery.latitude},${delivery.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                {delivery.latitude.toFixed(5)}, {delivery.longitude.toFixed(5)} (view on map)
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

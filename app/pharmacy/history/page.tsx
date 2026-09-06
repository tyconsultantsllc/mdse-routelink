"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle, XCircle, FileSignature } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

export default function PharmacyDeliveryHistoryPage() {
  const [stops, setStops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [signatureLoading, setSignatureLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: pharmacyUser } = await supabase.from("pharmacy_users").select("pharmacy_id").eq("id", user.id).single()
      if (!pharmacyUser) return

      // Full history, not just the last 5 - includes both delivered and
      // failed so pharmacies can see the complete picture, not just successes
      const { data, error } = await supabase
        .from("route_stops")
        .select("*, routes(name, drivers(users(first_name, last_name)))")
        .eq("pharmacy_id", pharmacyUser.pharmacy_id)
        .in("status", ["delivered", "failed"])
        .order("actual_delivery_time", { ascending: false })

      if (error) throw error
      setStops(data || [])
    } catch (error) {
      console.error("Error fetching delivery history:", error)
      toast({
        title: "Error",
        description: "Failed to load delivery history",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewSignature = async (stopId: string) => {
    setSignatureLoading(true)
    try {
      const { getDeliverySignatureUrl } = await import("@/app/actions/data-actions")
      const url = await getDeliverySignatureUrl(stopId)
      setSignatureUrl(url)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not load signature",
        variant: "destructive",
      })
    } finally {
      setSignatureLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 md:px-6 py-3 md:py-4">
          <Link href="/pharmacy">
            <Button variant="outline" size="icon" className="bg-transparent">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg md:text-2xl font-bold">Delivery History</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Full record of past deliveries</p>
          </div>
        </div>
      </header>

      <div className="p-3 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">All Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : stops.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No delivery history yet</p>
            ) : (
              <div className="space-y-3">
                {stops.map((stop) => {
                  const driver = stop.routes?.drivers?.users
                  const driverName = driver ? `${driver.first_name || ""} ${driver.last_name || ""}`.trim() : "Unknown"
                  const isDelivered = stop.status === "delivered"

                  return (
                    <div
                      key={stop.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between p-3 md:p-4 border rounded-lg gap-3"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isDelivered ? (
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                          )}
                          <span className="font-medium text-sm">{stop.routes?.name || "Route"}</span>
                          <Badge className={isDelivered ? "bg-green-500" : "bg-destructive"}>
                            {isDelivered ? "Delivered" : "Failed"}
                          </Badge>
                        </div>
                        <p className="text-xs md:text-sm text-muted-foreground">Driver: {driverName}</p>
                        <p className="text-xs md:text-sm text-muted-foreground break-words">
                          Dropoff: {stop.dropoff_address}
                        </p>
                        {isDelivered && stop.recipient_name && (
                          <p className="text-xs md:text-sm text-muted-foreground">Signed by: {stop.recipient_name}</p>
                        )}
                        {!isDelivered && stop.notes && (
                          <p className="text-xs md:text-sm text-destructive">Reason: {stop.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {stop.actual_delivery_time ? new Date(stop.actual_delivery_time).toLocaleString() : ""}
                        </p>
                      </div>
                      {isDelivered && stop.signature_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewSignature(stop.id)}
                          disabled={signatureLoading}
                        >
                          <FileSignature className="h-4 w-4 mr-2" />
                          View Signature
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!signatureUrl} onOpenChange={(open) => !open && setSignatureUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delivery Signature</DialogTitle>
          </DialogHeader>
          {signatureUrl && (
            <img src={signatureUrl || "/placeholder.svg"} alt="Delivery signature" className="w-full rounded-md border bg-white" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

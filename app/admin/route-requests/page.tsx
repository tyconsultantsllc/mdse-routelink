"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, MapPin, ExternalLink, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { AssignRouteRequestModal } from "@/components/assign-route-request-modal"
import { useToast } from "@/hooks/use-toast"
import { RegionBadge } from "@/components/region-badge"

export default function RouteRequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchRequests()
    const interval = setInterval(fetchRequests, 15000)
    return () => clearInterval(interval)
  }, [])

  const fetchRequests = async () => {
    try {
      const { getRouteRequests } = await import("@/app/actions/data-actions")
      const data = await getRouteRequests()
      setRequests(data)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = async (requestId: string) => {
    try {
      const { dismissRouteRequest } = await import("@/app/actions/data-actions")
      await dismissRouteRequest(requestId)
      toast({ title: "Request dismissed" })
      fetchRequests()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const emergencyCount = requests.filter((r) => r.is_emergency).length

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AdminHeader title="Route Requests" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">
              Route Requests {emergencyCount > 0 && <span className="text-destructive">({emergencyCount} emergency)</span>}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Delivery requests submitted by pharmacies, waiting for a driver to be assigned.
            </p>
          </div>

          {loading ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </Card>
          ) : requests.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No pending route requests.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => {
                const stops = (request.stops as Array<{ address: string; lat: number | null; lng: number | null }>) || []
                const missingCoords = stops.filter((s) => s.lat == null).length
                return (
                  <Card
                    key={request.id}
                    className={`p-4 ${request.is_emergency ? "border-l-4 border-l-destructive" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {request.is_emergency && (
                            <Badge className="bg-red-100 text-red-800">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Emergency
                            </Badge>
                          )}
                          <span className="text-sm font-medium">{request.pharmacies?.name || "Unknown Pharmacy"}</span>
                          <RegionBadge region={request.pharmacies?.region} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(request.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-foreground mb-2">
                          {stops.length} stop{stops.length !== 1 ? "s" : ""}
                          {missingCoords > 0 && (
                            <span className="text-destructive"> ({missingCoords} couldn't be located)</span>
                          )}
                        </p>
                        <div className="space-y-1">
                          {stops.map((s, i) => (
                            <p key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {s.address}
                            </p>
                          ))}
                        </div>
                        {request.source_link && (
                          <a
                            href={request.source_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View original link
                          </a>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button size="sm" onClick={() => setAssigning(request)}>
                          Assign Driver
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDismiss(request.id)}>
                          <X className="h-4 w-4 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <AssignRouteRequestModal
        open={!!assigning}
        onOpenChange={(open) => !open && setAssigning(null)}
        request={assigning}
        onAssigned={fetchRequests}
      />
    </div>
  )
}

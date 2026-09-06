"use client"

import { useState, useEffect } from "react"
import { AlertCircle, Package, HelpCircle, CheckCircle2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { useToast } from "@/hooks/use-toast"

const TYPE_CONFIG: Record<string, { label: string; icon: typeof AlertCircle; color: string }> = {
  problem: { label: "Problem", icon: AlertCircle, color: "bg-red-100 text-red-800" },
  pickup_request: { label: "Pickup Request", icon: Package, color: "bg-blue-100 text-blue-800" },
  other: { label: "Other", icon: HelpCircle, color: "bg-gray-100 text-gray-800" },
}

export default function PharmacyReportsPage() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchReports()
    const interval = setInterval(fetchReports, 15000)
    return () => clearInterval(interval)
  }, [])

  const fetchReports = async () => {
    try {
      const { getPharmacyReports } = await import("@/app/actions/data-actions")
      const data = await getPharmacyReports()
      // Open reports first, then newest first within each group
      setReports(
        [...data].sort((a, b) => {
          if (a.status !== b.status) return a.status === "open" ? -1 : 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }),
      )
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load pharmacy reports",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (reportId: string) => {
    try {
      const { resolvePharmacyReport } = await import("@/app/actions/data-actions")
      await resolvePharmacyReport(reportId)
      toast({ title: "Marked as resolved" })
      fetchReports()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const openCount = reports.filter((r) => r.status === "open").length

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminHeader title="Pharmacy Reports" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">
              Pharmacy Reports {openCount > 0 && <span className="text-destructive">({openCount} open)</span>}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Problems, pickup requests, and other issues raised by pharmacies.
            </p>
          </div>

          {loading ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </Card>
          ) : reports.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No reports from pharmacies yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const config = TYPE_CONFIG[report.type] || TYPE_CONFIG.other
                const Icon = config.icon
                return (
                  <Card
                    key={report.id}
                    className={`p-4 ${report.status === "open" ? "border-l-4 border-l-destructive" : "opacity-60"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge className={config.color}>
                            <Icon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                          <span className="text-sm font-medium">{report.pharmacies?.name || "Unknown Pharmacy"}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(report.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{report.message}</p>
                      </div>
                      {report.status === "open" ? (
                        <Button size="sm" variant="outline" onClick={() => handleResolve(report.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      ) : (
                        <Badge variant="secondary">Resolved</Badge>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

export function ScanMismatchesCard() {
  const [mismatches, setMismatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { getScanMismatches } = await import("@/app/actions/data-actions")
        const result = await getScanMismatches()
        setMismatches(result)
      } catch {
        // Quietly do nothing - this card is a bonus visibility feature,
        // not something that should interrupt the rest of the logs page.
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading || mismatches.length === 0) return null

  const visible = expanded ? mismatches : mismatches.slice(0, 3)

  return (
    <Card className="p-4 mb-6 border-amber-200 bg-amber-50/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="font-medium text-sm">Barcode Scan Mismatches</h3>
          <Badge variant="outline" className="text-xs">
            {mismatches.length}
          </Badge>
        </div>
        {mismatches.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
          >
            {expanded ? "Show less" : "Show all"}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Scans that didn't match what was packed for the stop. Drivers were able to proceed anyway - these are for
        review only.
      </p>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {visible.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 text-xs p-2 bg-background rounded-md">
            <div className="min-w-0">
              <span className="font-medium">{m.driverName}</span> scanned{" "}
              <span className="font-mono">{m.scannedBarcode}</span> at {m.stage} for{" "}
              <span className="font-medium">{m.routeName}</span> ({m.pharmacyName})
            </div>
            <span className="text-muted-foreground shrink-0">
              {new Date(m.createdAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

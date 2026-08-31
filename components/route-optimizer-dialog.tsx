"use client"

import { useState } from "react"
import { Sparkles, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { optimizeStopsWithOrder } from "@/lib/route-optimizer"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface RouteOptimizerDialogProps {
  isOpen: boolean
  onClose: () => void
  stops: any[]
  onOptimize: (optimizedStops: any[]) => void
}

export function RouteOptimizerDialog({ isOpen, onClose, stops, onOptimize }: RouteOptimizerDialogProps) {
  const [isOptimizing, setIsOptimizing] = useState(false)

  const handleOptimize = () => {
    setIsOptimizing(true)

    // Simulate processing time
    setTimeout(() => {
      const optimized = optimizeStopsWithOrder(stops)
      onOptimize(optimized.stops)
      setIsOptimizing(false)
      onClose()
    }, 1000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Optimize Route
          </DialogTitle>
          <DialogDescription>Automatically reorder stops for the most efficient delivery route</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              The optimizer will reorder {stops.length} stops based on:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Distance between stops (shortest path)</li>
                <li>Priority level (urgent stops first)</li>
                <li>Estimated delivery times</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-semibold">Current Route:</h4>
            <div className="space-y-1">
              {stops.map((stop, index) => (
                <div key={index} className="text-sm flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{index + 1}.</span>
                  <span>{stop.pharmacy?.name || stop.name || `Stop ${index + 1}`}</span>
                  {stop.priority && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        stop.priority === "urgent"
                          ? "bg-red-500 text-white"
                          : stop.priority === "high"
                            ? "bg-orange-500 text-white"
                            : stop.priority === "medium"
                              ? "bg-blue-500 text-white"
                              : "bg-gray-500 text-white"
                      }`}
                    >
                      {stop.priority}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleOptimize} disabled={isOptimizing}>
              {isOptimizing ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Optimize Route
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

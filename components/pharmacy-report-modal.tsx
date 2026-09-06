"use client"

import type React from "react"
import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { createPharmacyReport, type PharmacyReportType } from "@/lib/pharmacy-actions"

interface PharmacyReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pharmacyId: string
  userId: string
}

const REPORT_TYPES: { value: PharmacyReportType; label: string; description: string }[] = [
  { value: "problem", label: "Report a Problem", description: "Something went wrong with a delivery" },
  { value: "pickup_request", label: "Request a Pickup", description: "Ask dispatch to schedule a new pickup" },
  { value: "other", label: "Other", description: "Anything else admins should know about" },
]

export function PharmacyReportModal({ open, onOpenChange, pharmacyId, userId }: PharmacyReportModalProps) {
  const [type, setType] = useState<PharmacyReportType>("problem")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setIsSubmitting(true)
    try {
      await createPharmacyReport({ pharmacyId, reportedBy: userId, type, message: message.trim() })

      toast({
        title: "Report submitted",
        description: "Admins have been notified and will follow up.",
      })
      setMessage("")
      setType("problem")
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit report",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-2">
            <AlertCircle className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Contact Dispatch</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <RadioGroup value={type} onValueChange={(v) => setType(v as PharmacyReportType)}>
            {REPORT_TYPES.map((option) => (
              <div key={option.value} className="flex items-start space-x-2">
                <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                <Label htmlFor={option.value} className="font-normal cursor-pointer">
                  <span className="block font-medium text-foreground">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div>
            <Label htmlFor="message">Details</Label>
            <Textarea
              id="message"
              placeholder="Describe what's going on..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting || !message.trim()}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

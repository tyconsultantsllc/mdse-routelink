"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface FailDeliveryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pharmacyName: string
  onConfirm: (reason: string) => void
}

const QUICK_REASONS = ["Recipient not home", "Wrong or incomplete address", "Recipient refused delivery", "Other"]

export function FailDeliveryModal({ open, onOpenChange, pharmacyName, onConfirm }: FailDeliveryModalProps) {
  const [selectedReason, setSelectedReason] = useState("")
  const [notes, setNotes] = useState("")

  const handleSubmit = () => {
    const reason = selectedReason === "Other" ? notes.trim() : selectedReason
    if (!reason) return
    onConfirm(reason)
    setSelectedReason("")
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-destructive/10 mb-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">Mark Delivery as Failed</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">{pharmacyName}</p>

        <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
          {QUICK_REASONS.map((reason) => (
            <div key={reason} className="flex items-center space-x-2">
              <RadioGroupItem value={reason} id={reason} />
              <Label htmlFor={reason} className="font-normal">
                {reason}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {selectedReason === "Other" && (
          <Textarea
            placeholder="Describe what happened"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1 bg-transparent" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            onClick={handleSubmit}
            disabled={!selectedReason || (selectedReason === "Other" && !notes.trim())}
          >
            Confirm Failed
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

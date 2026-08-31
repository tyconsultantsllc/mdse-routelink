"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Camera, CheckCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad"

interface DeliveryConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pharmacyName: string
  onConfirm: (data: DeliveryConfirmationData) => void
}

export interface DeliveryConfirmationData {
  signature: string
  photos: string[]
  recipientName: string
  notes: string
  timestamp: Date
}

export function DeliveryConfirmationModal({
  open,
  onOpenChange,
  pharmacyName,
  onConfirm,
}: DeliveryConfirmationModalProps) {
  const { toast } = useToast()
  const [hasSignature, setHasSignature] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [recipientName, setRecipientName] = useState("")
  const [notes, setNotes] = useState("")
  const signaturePadRef = useRef<SignaturePadHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos((prev) => [...prev, event.target!.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleConfirm = () => {
    if (signaturePadRef.current?.isEmpty()) {
      toast({
        title: "Signature Required",
        description: "Please provide a signature to confirm delivery",
        variant: "destructive",
      })
      return
    }

    if (!recipientName.trim()) {
      toast({
        title: "Recipient Name Required",
        description: "Please enter the recipient's name",
        variant: "destructive",
      })
      return
    }

    onConfirm({
      signature: signaturePadRef.current?.toDataURL() || "",
      photos,
      recipientName,
      notes,
      timestamp: new Date(),
    })

    onOpenChange(false)
    resetForm()
  }

  const resetForm = () => {
    setHasSignature(false)
    setPhotos([])
    setRecipientName("")
    setNotes("")
    signaturePadRef.current?.clear()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Delivery</DialogTitle>
          <DialogDescription>Complete the delivery confirmation for {pharmacyName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Recipient Name */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Name *</Label>
            <Input
              id="recipient"
              placeholder="Enter recipient's full name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </div>

          {/* Signature Pad */}
          <div className="space-y-2">
            <Label>Signature *</Label>
            <Card className="p-4">
              <SignaturePad ref={signaturePadRef} onChange={setHasSignature} />
            </Card>
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label>Delivery Photos (Optional)</Label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                <Camera className="mr-2 h-4 w-4" />
                Take/Upload Photos
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={photo || "/placeholder.svg"}
                      alt={`Delivery photo ${index + 1}`}
                      className="w-full h-24 object-cover rounded-md"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePhoto(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Delivery Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes about the delivery..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Confirm Delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

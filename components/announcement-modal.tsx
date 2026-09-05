"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Megaphone } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface AnnouncementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  announcement?: any
  onSuccess: () => void
}

export function AnnouncementModal({ open, onOpenChange, announcement, onSuccess }: AnnouncementModalProps) {
  const [message, setMessage] = useState("")
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">("info")
  const [audience, setAudience] = useState<"all" | "admin" | "driver" | "pharmacy">("all")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (announcement) {
      setMessage(announcement.message || "")
      setSeverity(announcement.severity || "info")
      setAudience(announcement.audience || "all")
    } else {
      setMessage("")
      setSeverity("info")
      setAudience("all")
    }
  }, [announcement, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { createAnnouncement, updateAnnouncement } = await import("@/app/actions/data-actions")

      if (announcement) {
        await updateAnnouncement(announcement.id, { message, severity, audience })
      } else {
        await createAnnouncement({ message, severity, audience })
      }

      toast({
        title: "Success",
        description: announcement ? "Announcement updated" : "Announcement created",
      })
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{announcement ? "Edit Announcement" : "New Announcement"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="e.g. Scheduled maintenance tonight from 10pm-11pm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={3}
            />
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Show to</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="admin">Admins only</SelectItem>
                <SelectItem value="driver">Drivers only</SelectItem>
                <SelectItem value="pharmacy">Pharmacies only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? "Saving..." : announcement ? "Save Changes" : "Post Announcement"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

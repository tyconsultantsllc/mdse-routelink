"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, Megaphone } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { AnnouncementModal } from "@/components/announcement-modal"
import { useToast } from "@/hooks/use-toast"

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: "Everyone",
  admin: "Admins",
  driver: "Drivers",
  pharmacy: "Pharmacies",
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      const { getAnnouncements } = await import("@/app/actions/data-actions")
      const data = await getAnnouncements()
      setAnnouncements(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load announcements",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { updateAnnouncement } = await import("@/app/actions/data-actions")
      await updateAnnouncement(id, { isActive })
      fetchAnnouncements()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string, message: string) => {
    if (!confirm(`Delete this announcement?\n\n"${message}"`)) return

    try {
      const { deleteAnnouncement } = await import("@/app/actions/data-actions")
      await deleteAnnouncement(id)
      toast({ title: "Announcement deleted" })
      fetchAnnouncements()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminHeader title="Announcements" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-foreground">Manage Announcements</h2>
            <Button
              onClick={() => {
                setEditingAnnouncement(null)
                setIsModalOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Announcement
            </Button>
          </div>

          {loading ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </Card>
          ) : announcements.length === 0 ? (
            <Card className="p-8 text-center">
              <Megaphone className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No announcements yet. Create one to get started.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <Card key={a.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={SEVERITY_COLORS[a.severity]}>{a.severity}</Badge>
                      <Badge variant="outline">{AUDIENCE_LABELS[a.audience]}</Badge>
                      {!a.is_active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-foreground truncate">{a.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={a.is_active} onCheckedChange={(checked) => handleToggleActive(a.id, checked)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingAnnouncement(a)
                        setIsModalOpen(true)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id, a.message)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnnouncementModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        announcement={editingAnnouncement}
        onSuccess={fetchAnnouncements}
      />
    </div>
  )
}

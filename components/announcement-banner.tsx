"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, Info, AlertOctagon, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Announcement {
  id: string
  message: string
  severity: "info" | "warning" | "critical"
}

const SEVERITY_STYLES: Record<Announcement["severity"], string> = {
  info: "bg-blue-50 text-blue-900 border-blue-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  critical: "bg-red-50 text-red-900 border-red-200",
}

const SEVERITY_ICONS: Record<Announcement["severity"], typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertOctagon,
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissedIds, setDismissedIds] = useState<string[]>([])

  useEffect(() => {
    const dismissed = sessionStorage.getItem("dismissed_announcements")
    if (dismissed) setDismissedIds(JSON.parse(dismissed))

    const fetchAnnouncements = async () => {
      const supabase = createClient()
      // RLS (announcements_select_targeted) already filters this to active,
      // non-expired announcements matching the signed-in user's role.
      const { data } = await supabase
        .from("announcements")
        .select("id, message, severity")
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (data) setAnnouncements(data as Announcement[])
    }

    fetchAnnouncements()
  }, [])

  const handleDismiss = (id: string) => {
    const updated = [...dismissedIds, id]
    setDismissedIds(updated)
    sessionStorage.setItem("dismissed_announcements", JSON.stringify(updated))
  }

  const visible = announcements.filter((a) => !dismissedIds.includes(a.id))

  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-2 p-2">
      {visible.map((announcement) => {
        const Icon = SEVERITY_ICONS[announcement.severity]
        return (
          <div
            key={announcement.id}
            className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${SEVERITY_STYLES[announcement.severity]}`}
          >
            <Icon className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="flex-1">{announcement.message}</p>
            <button
              onClick={() => handleDismiss(announcement.id)}
              className="shrink-0 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

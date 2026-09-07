"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Menu, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationCenter, type Notification } from "@/components/notification-center"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

interface AdminHeaderProps {
  title: string
  children?: React.ReactNode
}

export function AdminHeader({ title, children }: AdminHeaderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  // Dismissed/read state is session-only, tracked locally here rather than
  // persisted - the underlying items (reports, messages) already have their
  // own real resolved/read tracking on their actual pages. This bell is a
  // live summary, not a second source of truth.
  const dismissedIdsRef = useRef<Set<string>>(new Set())
  const readIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    checkNotifications()
    const interval = setInterval(checkNotifications, 15000)
    return () => clearInterval(interval)
  }, [])

  const checkNotifications = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const notifs: Notification[] = []

      const { data: reports } = await supabase
        .from("pharmacy_reports")
        .select("id, type, message, created_at, pharmacies(name)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(5)

      for (const r of reports || []) {
        const id = `report-${r.id}`
        if (dismissedIdsRef.current.has(id)) continue
        notifs.push({
          id,
          type: r.type === "problem" ? "error" : "warning",
          title: (r as any).pharmacies?.name || "Pharmacy Report",
          message: r.message,
          timestamp: new Date(r.created_at),
          read: readIdsRef.current.has(id),
        })
      }

      const { data: readRows } = await supabase
        .from("admin_message_reads")
        .select("conversation_id, last_read_at")
        .eq("admin_id", user.id)
      const lastReadByConv = new Map((readRows || []).map((row: any) => [row.conversation_id, row.last_read_at]))

      const { data: dispatchConvos } = await supabase
        .from("conversations")
        .select("id, messages(sender_id, created_at)")
        .eq("type", "dispatch")

      let totalUnread = 0
      for (const c of dispatchConvos || []) {
        const lastRead = lastReadByConv.get(c.id)
        totalUnread += ((c as any).messages || []).filter(
          (m: any) => m.sender_id !== user.id && (!lastRead || new Date(m.created_at) > new Date(lastRead)),
        ).length
      }

      if (totalUnread > 0 && !dismissedIdsRef.current.has("unread-messages")) {
        notifs.push({
          id: "unread-messages",
          type: "info",
          title: "Unread Messages",
          message: `You have ${totalUnread} unread driver message${totalUnread > 1 ? "s" : ""}`,
          timestamp: new Date(),
          read: readIdsRef.current.has("unread-messages"),
        })
      }

      setNotifications(notifs)
    } catch (error) {
      console.error("Error checking notifications:", error)
    }
  }

  const handleMarkAsRead = (id: string) => {
    readIdsRef.current.add(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const handleMarkAllAsRead = () => {
    notifications.forEach((n) => readIdsRef.current.add(n.id))
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleDismiss = (id: string) => {
    dismissedIdsRef.current.add(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    localStorage.removeItem("mdse_routelink_user")
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out",
    })
    router.push("/auth/login")
  }

  return (
    <div className="flex-shrink-0 bg-card border-b border-border">
      <div className="flex justify-between items-center h-16 px-4">
        <div className="flex items-center md:hidden">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-lg font-medium text-foreground">{title}</h1>
          </div>
          <div className="ml-4 flex items-center md:ml-6 gap-2">
            {children}
            <NotificationCenter
              notifications={notifications}
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
              onDismiss={handleDismiss}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Logout</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  )
}

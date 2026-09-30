"use client"

/**
 * Polls the signed-in user's notifications (scripts/030_notifications.sql)
 * and adapts them to the shape components/notification-center.tsx already
 * expects - the same bell component the admin portal uses, just backed by
 * real persisted rows instead of admin-header.tsx's own live-computed
 * list. Polling every 15s matches every other "check for updates"
 * interval already used across the app (see components/admin-header.tsx,
 * driver-messaging-widget.tsx, etc.) rather than introducing a different
 * cadence just for this.
 */
import { useEffect, useRef, useState } from "react"
import type { Notification } from "@/components/notification-center"
import {
  dismissNotification,
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/data-actions"

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const mountedRef = useRef(true)

  const refresh = async () => {
    try {
      const rows = await getMyNotifications()
      if (!mountedRef.current) return
      setNotifications(
        (rows || []).map((r: any) => ({
          id: r.id,
          type: r.severity,
          title: r.title,
          message: r.message,
          timestamp: new Date(r.created_at),
          read: r.read,
        })),
      )
    } catch (error) {
      console.error("Failed to load notifications:", error)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    refresh()
    const interval = setInterval(refresh, 15000)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [])

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    markNotificationRead(id).catch((error) => console.error("Failed to mark notification read:", error))
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    markAllNotificationsRead().catch((error) => console.error("Failed to mark all notifications read:", error))
  }

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    dismissNotification(id).catch((error) => console.error("Failed to dismiss notification:", error))
  }

  return { notifications, markAsRead, markAllAsRead, dismiss }
}

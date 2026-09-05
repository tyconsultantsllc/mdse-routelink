"use client"

import { useState, useEffect } from "react"
import { MessageCircle, Radio, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChatPanel } from "@/components/chat-panel"
import { createClient } from "@/lib/supabase/client"
import {
  getOrCreateDispatchConversation,
  getOrCreateDirectConversation,
  isDriverToDriverMessagingEnabled,
  getOtherDrivers,
  getUnreadCountForDriver,
  markConversationRead,
} from "@/lib/messaging"

interface DriverMessagingWidgetProps {
  driverId: string
}

export function DriverMessagingWidget({ driverId }: DriverMessagingWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [driverName, setDriverName] = useState("")
  const [dispatchConversationId, setDispatchConversationId] = useState<string | null>(null)
  const [directMessagingEnabled, setDirectMessagingEnabled] = useState(false)
  const [otherDrivers, setOtherDrivers] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeView, setActiveView] = useState<{ type: "dispatch" } | { type: "driver"; conversationId: string; name: string }>({
    type: "dispatch",
  })

  useEffect(() => {
    const checkUnread = () => {
      getUnreadCountForDriver(driverId).then(setUnreadCount).catch(() => {})
    }
    checkUnread()
    const interval = setInterval(checkUnread, 15000)
    return () => clearInterval(interval)
  }, [driverId])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("users").select("first_name, last_name").eq("id", driverId).single()
      if (data) setDriverName(`${data.first_name || ""} ${data.last_name || ""}`.trim())

      const enabled = await isDriverToDriverMessagingEnabled()
      setDirectMessagingEnabled(enabled)
      if (enabled) {
        const drivers = await getOtherDrivers(driverId)
        setOtherDrivers(drivers as any)
      }
    }
    init()
  }, [driverId])

  useEffect(() => {
    if (!isOpen) return
    getOrCreateDispatchConversation(driverId).then((id) => {
      setDispatchConversationId(id)
      markConversationRead(id, driverId).then(() => setUnreadCount(0))
    })
  }, [isOpen, driverId])

  const handleOpenDriverChat = async (otherDriver: { id: string; first_name: string; last_name: string }) => {
    const conversationId = await getOrCreateDirectConversation(driverId, otherDriver.id)
    setActiveView({
      type: "driver",
      conversationId,
      name: `${otherDriver.first_name} ${otherDriver.last_name}`.trim(),
    })
    markConversationRead(conversationId, driverId).then(() => {
      getUnreadCountForDriver(driverId).then(setUnreadCount)
    })
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        className="fixed bottom-20 right-4 md:bottom-6 h-14 w-14 rounded-full shadow-lg z-30"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Messages</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 px-4 pt-3 border-b pb-3 flex-wrap">
            <Button
              size="sm"
              variant={activeView.type === "dispatch" ? "default" : "outline"}
              onClick={() => setActiveView({ type: "dispatch" })}
            >
              <Radio className="h-3.5 w-3.5 mr-1.5" />
              Dispatch
            </Button>
            {directMessagingEnabled &&
              otherDrivers.map((driver) => (
                <Button
                  key={driver.id}
                  size="sm"
                  variant={
                    activeView.type === "driver" && activeView.name === `${driver.first_name} ${driver.last_name}`.trim()
                      ? "default"
                      : "outline"
                  }
                  onClick={() => handleOpenDriverChat(driver)}
                >
                  <User className="h-3.5 w-3.5 mr-1.5" />
                  {driver.first_name}
                </Button>
              ))}
          </div>

          {activeView.type === "dispatch" ? (
            dispatchConversationId ? (
              <ChatPanel conversationId={dispatchConversationId} currentUserId={driverId} currentUserName={driverName} />
            ) : (
              <div className="h-96 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
            )
          ) : (
            <ChatPanel conversationId={activeView.conversationId} currentUserId={driverId} currentUserName={driverName} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

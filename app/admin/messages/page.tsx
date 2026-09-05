"use client"

import { useState, useEffect } from "react"
import { MessageSquare, Megaphone } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { ChatPanel } from "@/components/chat-panel"
import { createClient } from "@/lib/supabase/client"
import { isDriverToDriverMessagingEnabled, setDriverToDriverMessagingEnabled } from "@/lib/messaging"
import { useToast } from "@/hooks/use-toast"

export default function MessagesPage() {
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [directMessagingEnabled, setDirectMessagingEnabled] = useState(false)
  const [adminId, setAdminId] = useState<string>("")
  const [adminName, setAdminName] = useState("")
  const [loading, setLoading] = useState(true)
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState("")
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      setAdminId(user.id)
      const { data } = await supabase.from("users").select("first_name, last_name").eq("id", user.id).single()
      if (data) setAdminName(`${data.first_name || ""} ${data.last_name || ""}`.trim())
    }

    const enabled = await isDriverToDriverMessagingEnabled()
    setDirectMessagingEnabled(enabled)

    await fetchConversations()
    setLoading(false)
  }

  const fetchConversations = async () => {
    try {
      const { getDispatchConversations } = await import("@/app/actions/data-actions")
      const data = await getDispatchConversations()
      setConversations(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      })
    }
  }

  const handleToggleDirectMessaging = async (enabled: boolean) => {
    try {
      await setDriverToDriverMessagingEnabled(enabled)
      setDirectMessagingEnabled(enabled)
      toast({
        title: enabled ? "Driver-to-driver messaging enabled" : "Driver-to-driver messaging disabled",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return

    setIsSendingBroadcast(true)
    try {
      const { broadcastMessageToAllDrivers } = await import("@/app/actions/data-actions")
      const result = await broadcastMessageToAllDrivers(broadcastMessage.trim())

      toast({
        title: "Message sent",
        description: `Delivered to ${result.sentTo} driver${result.sentTo === 1 ? "" : "s"}`,
      })
      setBroadcastMessage("")
      setIsBroadcastOpen(false)
      fetchConversations()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send broadcast",
        variant: "destructive",
      })
    } finally {
      setIsSendingBroadcast(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminHeader title="Messages" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setIsBroadcastOpen(true)}>
              <Megaphone className="mr-2 h-4 w-4" />
              Message All Drivers
            </Button>
          </div>

          <Card className="p-4 mb-6 flex items-center justify-between">
            <div>
              <Label htmlFor="direct-messaging-toggle" className="text-sm font-medium">
                Allow drivers to message each other
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When off, drivers can only message dispatch, not other drivers directly.
              </p>
            </div>
            <Switch
              id="direct-messaging-toggle"
              checked={directMessagingEnabled}
              onCheckedChange={handleToggleDirectMessaging}
            />
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1 overflow-hidden">
              <div className="p-3 border-b font-medium text-sm">Driver Conversations</div>
              {loading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading...</p>
              ) : conversations.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No messages from drivers yet.</p>
              ) : (
                <div className="divide-y">
                  {conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedConversationId(c.id)}
                      className={`w-full text-left p-3 hover:bg-muted transition-colors ${
                        selectedConversationId === c.id ? "bg-muted" : ""
                      }`}
                    >
                      <p className="font-medium text-sm">{c.driverName}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.lastMessage || "No messages yet"}</p>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="md:col-span-2">
              {selectedConversationId ? (
                <ChatPanel conversationId={selectedConversationId} currentUserId={adminId} currentUserName={adminName} />
              ) : (
                <div className="h-96 flex flex-col items-center justify-center text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2" />
                  <p className="text-sm">Select a conversation to view messages</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message All Drivers</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            This sends one message into each driver's own dispatch conversation. Their replies come back to you
            individually — drivers won't see each other's responses.
          </p>
          <Textarea
            placeholder="e.g. Reminder: submit your delivery logs by end of day"
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            rows={4}
          />
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => setIsBroadcastOpen(false)}
              disabled={isSendingBroadcast}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleSendBroadcast}
              disabled={isSendingBroadcast || !broadcastMessage.trim()}
            >
              {isSendingBroadcast ? "Sending..." : "Send to All Drivers"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

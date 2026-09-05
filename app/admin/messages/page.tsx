"use client"

import { useState, useEffect } from "react"
import { MessageSquare } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminHeader title="Messages" />
        <div className="flex-1 overflow-y-auto p-6">
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
    </div>
  )
}

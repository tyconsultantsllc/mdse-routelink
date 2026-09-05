"use client"

import { useState, useEffect, useRef } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getMessages, sendMessage, type Message } from "@/lib/messaging"

interface ChatPanelProps {
  conversationId: string
  currentUserId: string
  currentUserName: string
}

export function ChatPanel({ conversationId, currentUserId, currentUserName }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const data = await getMessages(conversationId)
        if (!cancelled) setMessages(data)
      } catch {
        // Polling failures are silent — the next poll a few seconds later
        // will just try again, no need to interrupt the user over one miss.
      }
    }

    load()
    // Simple polling rather than a Realtime subscription — fewer moving
    // parts, and a few seconds of latency is fine for this use case.
    const interval = setInterval(load, 4000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return

    const content = input.trim()
    setInput("")
    setSending(true)

    // Optimistic update so sending feels instant rather than waiting for
    // the next poll cycle to show your own message back to you.
    const optimisticMessage: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      sender_name: currentUserName,
    }
    setMessages((prev) => [...prev, optimisticMessage])

    try {
      await sendMessage(conversationId, currentUserId, content)
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id))
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-96">
      <div className="flex-1 overflow-y-auto space-y-3 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-8">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => {
            const isOwn = m.sender_id === currentUserId
            return (
              <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {!isOwn && m.sender_name && (
                    <p className="text-xs font-medium mb-0.5 opacity-70">{m.sender_name}</p>
                  )}
                  <p>{m.content}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 p-3 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Type a message..."
          disabled={sending}
        />
        <Button size="icon" onClick={handleSend} disabled={sending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

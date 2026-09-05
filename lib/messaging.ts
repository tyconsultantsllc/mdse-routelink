import { createClient } from "@/lib/supabase/client"

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  sender_name?: string
}

/**
 * Every driver has exactly one dispatch conversation, shared with all
 * admins. Finds it if it exists, creates it on first use otherwise.
 */
export async function getOrCreateDispatchConversation(driverId: string): Promise<string> {
  const supabase = createClient()

  const { data: existing } = await supabase
    .from("conversation_participants")
    .select("conversation_id, conversations!inner(type)")
    .eq("user_id", driverId)
    .eq("conversations.type", "dispatch")
    .maybeSingle()

  if (existing) return existing.conversation_id

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({ type: "dispatch" })
    .select()
    .single()

  if (convError) throw convError

  const { error: participantError } = await supabase
    .from("conversation_participants")
    .insert({ conversation_id: conversation.id, user_id: driverId })

  if (participantError) throw participantError

  return conversation.id
}

/**
 * Finds or creates a direct conversation between two drivers. Callers
 * should check isDriverToDriverMessagingEnabled() first — RLS also
 * enforces this independently (see 008_messaging.sql), so this fails
 * safely even if that check is skipped.
 */
export async function getOrCreateDirectConversation(userIdA: string, userIdB: string): Promise<string> {
  const supabase = createClient()

  const { data: existing } = await supabase
    .from("conversation_participants")
    .select("conversation_id, conversations!inner(type)")
    .eq("user_id", userIdA)
    .eq("conversations.type", "direct")

  if (existing) {
    for (const row of existing) {
      const { data: otherParticipant } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", row.conversation_id)
        .eq("user_id", userIdB)
        .maybeSingle()

      if (otherParticipant) return row.conversation_id
    }
  }

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({ type: "direct" })
    .select()
    .single()

  if (convError) throw convError

  const { error: participantError } = await supabase.from("conversation_participants").insert([
    { conversation_id: conversation.id, user_id: userIdA },
    { conversation_id: conversation.id, user_id: userIdB },
  ])

  if (participantError) throw participantError

  return conversation.id
}

export async function sendMessage(conversationId: string, senderId: string, content: string) {
  const supabase = createClient()

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content,
  })

  if (error) throw error
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("messages")
    .select("*, users!messages_sender_id_fkey(first_name, last_name)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  if (error) throw error

  return (data || []).map((m: any) => ({
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    content: m.content,
    created_at: m.created_at,
    sender_name: m.users ? `${m.users.first_name || ""} ${m.users.last_name || ""}`.trim() : undefined,
  }))
}

export async function isDriverToDriverMessagingEnabled(): Promise<boolean> {
  const supabase = createClient()

  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "driver_to_driver_messaging_enabled")
    .maybeSingle()

  return data?.value === true
}

export async function setDriverToDriverMessagingEnabled(enabled: boolean) {
  const supabase = createClient()

  // RLS (app_settings_modify_admin) independently rejects this for
  // non-admins regardless of what the calling UI allows.
  const { error } = await supabase
    .from("app_settings")
    .update({ value: enabled, updated_at: new Date().toISOString() })
    .eq("key", "driver_to_driver_messaging_enabled")

  if (error) throw error
}

export async function getOtherDrivers(currentDriverId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .eq("role", "driver")
    .neq("id", currentDriverId)

  if (error) throw error
  return data || []
}

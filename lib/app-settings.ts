import { createClient } from "@/lib/supabase/client"

export async function getAppSetting<T = any>(key: string): Promise<T | null> {
  const supabase = createClient()
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle()
  return (data?.value as T) ?? null
}

export async function setAppSetting(key: string, value: any) {
  const supabase = createClient()
  // RLS (app_settings_modify_admin) independently rejects this for
  // non-admins regardless of what the calling UI allows.
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })

  if (error) throw new Error(`Could not save setting: ${error.message}`)
}

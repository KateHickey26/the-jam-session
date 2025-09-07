import { supabase } from "./supabase"

export async function ensureSession(code: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("code", code)
    .maybeSingle()

  if (error) throw error
  if (data) return data.id

  const { data: inserted, error: insertErr } = await supabase
    .from("sessions")
    .insert({ code })
    .select("id")
    .single()

  if (insertErr) throw insertErr
  return inserted.id
}

export async function fetchLatestSessionForUser(userId: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id,name,created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, name: data.name as string };
}